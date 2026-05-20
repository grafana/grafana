package folders

import (
	"context"
	"net/http"
	"strconv"

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
// Currently limited to the folder and dashboard domains. The legacy endpoint
// (pkg/api/folder.go getFolderACMetadata) flattens every action scoped to
// folders:uid:<UID>, which also includes library.panels, annotations, and
// alerting actions when granted on a folder. Those domains are not yet
// represented here, so clients that depend on them must keep calling
// /api/folders/{uid}?accesscontrol=true. Expanding this list is tracked
// separately — it needs RBAC-mapper coverage (alerting still has none) and
// frontend coordination before the dual call can be dropped.
var folderAccessActions = []folderAccessAction{
	// Folder domain — Name = this folder, folder hint = immediate parent.
	{Action: "folders:read", Verb: utils.VerbGet},
	{Action: "folders:write", Verb: utils.VerbUpdate},
	{Action: "folders:delete", Verb: utils.VerbDelete},
	{Action: "folders:create", Verb: utils.VerbCreate},
	{Action: "folders.permissions:read", Verb: utils.VerbGetPermissions},
	{Action: "folders.permissions:write", Verb: utils.VerbSetPermissions},

	// Dashboard domain — only `create` is correct here. The RBAC service short-
	// circuits non-Create checks when Name=="" (pkg/services/authz/rbac/service.go
	// checkPermission) and returns true if the user has the action on any scope,
	// ignoring the folder hint. Create is the one verb that walks the parent
	// chain via checkInheritedPermissions. The remaining dashboards:* keys
	// (read/write/delete/.permissions:*) need either a service-side fix to honor
	// the folder hint for non-Create verbs, or a Name-based call shape; until
	// then they must come from the legacy /api/folders/{uid}?accesscontrol=true.
	{Action: "dashboards:create", Verb: utils.VerbCreate, Group: "dashboard.grafana.app", Resource: "dashboards"},
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

	// One BatchCheck for all actions. authlib + Zanzana walk the parent chain
	// internally given the immediate parent UID, so we don't need to enumerate
	// ancestors ourselves. CorrelationID must match OpenFGA's [\w-]{1,36} regex,
	// so we use the slice index instead of the legacy "domain:verb" action key.
	checks := make([]authlib.BatchCheckItem, len(folderAccessActions))
	for i, a := range folderAccessActions {
		group := a.Group
		if group == "" {
			group = foldersV1.GROUP
		}
		resource := a.Resource
		if resource == "" {
			resource = foldersV1.RESOURCE
		}

		// Folder-domain checks ask "can the user do <verb> on THIS folder":
		// Name=this folder UID, folder hint=immediate parent.
		// Cross-domain checks (currently only dashboards:create) ask "can the
		// user create within this folder": Name="", folder hint=this folder
		// UID; Create walks the parent chain via the RBAC service's
		// checkInheritedPermissions path.
		reqName, reqFolder := name, parent
		if group != foldersV1.GROUP || resource != foldersV1.RESOURCE {
			reqName, reqFolder = "", name
		}

		checks[i] = authlib.BatchCheckItem{
			CorrelationID: strconv.Itoa(i),
			Verb:          a.Verb,
			Group:         group,
			Resource:      resource,
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
