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

// folderAccessAction is one row in the access check matrix.
type folderAccessAction struct {
	Action   string // legacy key, e.g. "folders:write" / "dashboards:create"
	Verb     string // authlib verb
	Group    string // optional: defaults to folder.grafana.app
	Resource string // optional: defaults to folders
}

// folderAccessActions lists the legacy RBAC actions surfaced in AccessControl.
//
// Scope today: domains with a real *.grafana.app API group that are routed to
// Zanzana via the authzLimitedClient allowlist in
// pkg/storage/unified/resource/access.go — `folders` and `dashboards`. For
// these, Check returns an authoritative answer (verified empirically against a
// running Zanzana).
//
// Out of scope (returns false even when the user has the permission via legacy
// SQL): `library.panels:*`, `alert.rules:*`, `alert.silences:*`,
// `annotations:*`, and `dashboards.permissions:*`. Adding them would mislead
// clients. Revisit once those resources land on unified storage with their own
// API groups.
var folderAccessActions = []folderAccessAction{
	// Folder domain — Name = this folder, folder hint = immediate parent.
	{Action: "folders:read", Verb: utils.VerbGet},
	{Action: "folders:write", Verb: utils.VerbUpdate},
	{Action: "folders:delete", Verb: utils.VerbDelete},
	{Action: "folders:create", Verb: utils.VerbCreate},
	{Action: "folders.permissions:read", Verb: utils.VerbGetPermissions},
	{Action: "folders.permissions:write", Verb: utils.VerbSetPermissions},

	// Dashboard domain — Name = "", folder hint = this folder. Asks
	// "can the user act on a dashboard within this folder".
	{Action: "dashboards:read", Verb: utils.VerbGet, Group: "dashboard.grafana.app", Resource: "dashboards"},
	{Action: "dashboards:write", Verb: utils.VerbUpdate, Group: "dashboard.grafana.app", Resource: "dashboards"},
	{Action: "dashboards:create", Verb: utils.VerbCreate, Group: "dashboard.grafana.app", Resource: "dashboards"},
	{Action: "dashboards:delete", Verb: utils.VerbDelete, Group: "dashboard.grafana.app", Resource: "dashboards"},
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

	// Issue one Check per action. We deliberately use Check (not BatchCheck)
	// because Zanzana's BatchCheck is still being completed for some resource
	// types — see the SA1019 nolints across pkg/storage/unified/resource/ and
	// pkg/registry/apis/iam/ that note "BatchCheck is not yet fully implemented".
	// authlib + Zanzana walk the parent chain internally given the immediate
	// parent UID, so we don't need to enumerate ancestors ourselves.
	allowed := make(map[string]bool, len(folderAccessActions))
	for _, a := range folderAccessActions {
		group := a.Group
		if group == "" {
			group = foldersV1.GROUP
		}
		resource := a.Resource
		if resource == "" {
			resource = foldersV1.RESOURCE
		}

		// Semantics:
		//   folder-domain  → "can the user do <verb> on THIS folder"
		//                    Name=this folder UID, folder hint=immediate parent.
		//   cross-domain   → "can the user do <verb> on resources WITHIN this folder"
		//                    Name="", folder hint=this folder UID.
		reqName, reqFolder := name, parent
		if group != foldersV1.GROUP || resource != foldersV1.RESOURCE {
			reqName, reqFolder = "", name
		}

		resp, err := r.accessClient.Check(ctx, user, authlib.CheckRequest{
			Verb:      a.Verb,
			Group:     group,
			Resource:  resource,
			Namespace: ns.Value,
			Name:      reqName,
		}, reqFolder)
		if err != nil {
			return nil, err
		}
		allowed[a.Action] = resp.Allowed
	}

	rsp := &foldersV1.FolderAccessInfo{}

	// Preserve the legacy 4-bool surface. CanAdmin implies the other three
	// (parity with the previous implementation).
	rsp.CanAdmin = allowed["folders.permissions:write"]
	rsp.CanDelete = rsp.CanAdmin || allowed["folders:delete"]
	rsp.CanEdit = rsp.CanAdmin || allowed["folders:write"]
	rsp.CanSave = rsp.CanAdmin || allowed["folders:create"]

	// Build the AccessControl map: only keys for actions the user has are
	// included, matching the legacy dtos.Folder.AccessControl shape.
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
