package folders

import (
	"context"
	"net/http"
	"strconv"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
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

type folderAccessAction struct {
	Action   string // legacy RBAC key, e.g. "folders:write"
	Verb     string
	Group    string
	Resource string
}

// folderAccessActions are limited to the folder and dashboard domains. The
// legacy endpoint (pkg/api/folder.go getFolderACMetadata) also flattens
// library.panels, annotations, and alerting actions scoped to a folder, so
// clients that need those must keep calling /api/folders/{uid}?accesscontrol=true.
var folderAccessActions = []folderAccessAction{
	{Action: "folders:read", Verb: utils.VerbGet, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},
	{Action: "folders:write", Verb: utils.VerbUpdate, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},
	{Action: "folders:delete", Verb: utils.VerbDelete, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},
	{Action: "folders:create", Verb: utils.VerbCreate, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},
	{Action: "folders.permissions:read", Verb: utils.VerbGetPermissions, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},
	{Action: "folders.permissions:write", Verb: utils.VerbSetPermissions, Group: foldersV1.GROUP, Resource: foldersV1.RESOURCE},

	// Only `create` is correct cross-domain: the RBAC service short-circuits
	// non-Create checks when Name=="" and returns true if the user has the
	// action on any scope, ignoring the folder hint. Create is the one verb
	// that walks the parent chain via checkInheritedPermissions.
	{Action: "dashboards:create", Verb: utils.VerbCreate, Group: dashboardV1.GROUP, Resource: dashboardV1.DASHBOARD_RESOURCE},
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

	f, err := r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}
	parent := obj.GetFolder()

	// CorrelationID must match the [\w-]{1,36} regex enforced downstream, so
	// we use the slice index instead of the legacy "domain:verb" action key.
	checks := make([]authlib.BatchCheckItem, len(folderAccessActions))
	for i, a := range folderAccessActions {
		// Cross-domain checks use Name="" + Folder=this folder UID as a
		// workaround for an authlib gap: Name="" was designed for namespace-
		// wide list/watch, not "in this folder". The legacy RBAC service's
		// checkInheritedPermissions walks the parent chain for Create in this
		// shape. Revisit once authlib grows a folder-scoped check API.
		reqName, reqFolder := name, parent
		if a.Group != foldersV1.GROUP || a.Resource != foldersV1.RESOURCE {
			reqName, reqFolder = "", name
		}

		checks[i] = authlib.BatchCheckItem{
			CorrelationID: strconv.Itoa(i),
			Verb:          a.Verb,
			Group:         a.Group,
			Resource:      a.Resource,
			Name:          reqName,
			Folder:        reqFolder,
		}
	}

	batchResp, err := r.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: ns.Value,
		Checks:    checks,
	})
	if err != nil {
		return nil, err
	}

	allowed := make(map[string]bool, len(folderAccessActions))
	for i, a := range folderAccessActions {
		result := batchResp.Results[strconv.Itoa(i)]
		if result.Error != nil {
			return nil, result.Error
		}
		allowed[a.Action] = result.Allowed
	}

	rsp := &foldersV1.FolderAccessInfo{}

	// CanAdmin implies the other three, matching the legacy 4-bool surface.
	rsp.CanAdmin = allowed["folders.permissions:write"]
	rsp.CanDelete = rsp.CanAdmin || allowed["folders:delete"]
	rsp.CanEdit = rsp.CanAdmin || allowed["folders:write"]
	rsp.CanSave = rsp.CanAdmin || allowed["folders:create"]

	ac := make(map[string]bool, len(folderAccessActions))
	for _, a := range folderAccessActions {
		if allowed[a.Action] {
			ac[a.Action] = true
		}
	}
	if len(ac) > 0 {
		rsp.AccessControl = ac
	}

	return rsp, nil
}
