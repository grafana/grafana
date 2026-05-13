package folders

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type subAccessREST struct {
	getter       rest.Getter
	accessClient authlib.AccessClient
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &foldersV1.FolderAccessInfo{}
}

func (r *subAccessREST) Destroy() {
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subAccessREST) ProducesObject(verb string) interface{} {
	return &foldersV1.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access, err := r.getAccessInfo(ctx, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, access)
		}
	}), nil
}

// folderAccessAction is one row in the access check matrix: the legacy
// action string the frontend keys off, and the (verb) that maps to it on
// the folder.grafana.app/folders resource. The authz system walks the
// parent chain via Zanzana when answering, so a single BatchCheck per
// folder is enough to capture inherited permissions.
type folderAccessAction struct {
	Action string // legacy key, e.g. "folders:write"
	Verb   string // authlib verb on folder.grafana.app/folders
}

// folderAccessActions enumerates the folder-domain actions returned in
// AccessControl. Cross-domain inheritance (dashboards:*, library.panels:*,
// alert.rules:*) is intentionally out of scope for v1 — those resources
// live in legacy SQL and their permissions are not yet uniformly checkable
// through authlib in MT. Tracking issue: follow-up to A1.1.
var folderAccessActions = []folderAccessAction{
	{Action: "folders:read", Verb: utils.VerbGet},
	{Action: "folders:write", Verb: utils.VerbUpdate},
	{Action: "folders:delete", Verb: utils.VerbDelete},
	{Action: "folders:create", Verb: utils.VerbCreate},
	{Action: "folders.permissions:read", Verb: utils.VerbGetPermissions},
	{Action: "folders.permissions:write", Verb: utils.VerbSetPermissions},
}

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*foldersV1.FolderAccessInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Can view is managed here (and in the Authorizer)
	f, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}
	parent := obj.GetFolder()

	// One BatchCheck per folder captures every action in folderAccessActions.
	// authlib + Zanzana walk the parent chain internally given the immediate
	// parent UID, so we don't need to enumerate ancestors ourselves.
	checks := make([]authlib.BatchCheckItem, 0, len(folderAccessActions))
	for _, a := range folderAccessActions {
		checks = append(checks, authlib.BatchCheckItem{
			CorrelationID: a.Action,
			Verb:          a.Verb,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        parent,
		})
	}
	batchResp, err := r.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: ns.Value,
		Checks:    checks,
	})
	if err != nil {
		return nil, err
	}

	allowed := func(action string) bool {
		res, ok := batchResp.Results[action]
		return ok && res.Allowed
	}

	rsp := &foldersV1.FolderAccessInfo{}

	// Preserve the legacy 4-bool surface. CanAdmin implies the other three
	// (parity with the previous implementation).
	rsp.CanAdmin = allowed("folders.permissions:write")
	rsp.CanDelete = rsp.CanAdmin || allowed("folders:delete")
	rsp.CanEdit = rsp.CanAdmin || allowed("folders:write")
	rsp.CanSave = rsp.CanAdmin || allowed("folders:create")

	// Build the AccessControl map: only keys for actions the user has are
	// included, matching the legacy dtos.Folder.AccessControl shape.
	ac := make(map[string]bool, len(folderAccessActions))
	for _, a := range folderAccessActions {
		if allowed(a.Action) {
			ac[a.Action] = true
		}
	}
	if len(ac) > 0 {
		rsp.AccessControl = ac
	}

	return rsp, nil
}
