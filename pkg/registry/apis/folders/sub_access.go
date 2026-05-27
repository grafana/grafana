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

// folderTier mirrors the legacy folder permission levels (View / Edit / Admin)
// that folder.go uses to bundle dashboard, alerting, library-panel, and
// annotation actions onto a folder scope.
type folderTier int

const (
	tierNone folderTier = iota
	tierViewer
	tierEditor
	tierAdmin
)

// folderTierCheck is one of the five folder-resource probes we send. The
// CorrelationID must match the [\w-]{1,36} regex enforced downstream, so we
// use a short stable slug instead of the legacy "domain:verb" action key.
type folderTierCheck struct {
	correlationID string
	verb          string
}

// folderTierChecks are the only items we send to BatchCheck. Sub-resource
// permissions (dashboards, alerts, library panels, annotations) are inferred
// from the resulting tier — they are NOT checked individually, matching the
// legacy folder View/Edit/Admin bundling in
// pkg/services/accesscontrol/ossaccesscontrol/folder.go.
var folderTierChecks = []folderTierCheck{
	{correlationID: "get", verb: utils.VerbGet},
	{correlationID: "create", verb: utils.VerbCreate},
	{correlationID: "update", verb: utils.VerbUpdate},
	{correlationID: "delete", verb: utils.VerbDelete},
	{correlationID: "setperms", verb: utils.VerbSetPermissions},
}

// Action bundles below mirror FolderViewActions / FolderEditActions /
// FolderAdminActions and DashboardViewActions / DashboardEditActions /
// DashboardAdminActions in pkg/services/accesscontrol/ossaccesscontrol/. They
// are inlined to avoid pulling that package's heavy DI graph into the apiserver
// edge. Keep in sync if either bundle changes.
var (
	folderViewActions = []string{
		"folders:read",
		"alert.rules:read",
		"library.panels:read",
		"alert.silences:read",
	}
	folderEditActions = append(append([]string{}, folderViewActions...), []string{
		"folders:write",
		"folders:delete",
		"folders:create",
		"dashboards:create",
		"alert.rules:create",
		"alert.rules:write",
		"alert.rules:delete",
		"alert.silences:create",
		"alert.silences:write",
		"library.panels:create",
		"library.panels:write",
		"library.panels:delete",
	}...)
	folderAdminActions = append(append([]string{}, folderEditActions...), []string{
		"folders.permissions:read",
		"folders.permissions:write",
	}...)

	dashboardViewActions = []string{
		"dashboards:read",
		"annotations:read",
	}
	dashboardEditActions = append(append([]string{}, dashboardViewActions...), []string{
		"dashboards:write",
		"dashboards:delete",
		"annotations:write",
		"annotations:delete",
		"annotations:create",
	}...)
	dashboardAdminActions = append(append([]string{}, dashboardEditActions...), []string{
		"dashboards.permissions:read",
		"dashboards.permissions:write",
	}...)
)

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

	checks := make([]authlib.BatchCheckItem, len(folderTierChecks))
	for i, c := range folderTierChecks {
		checks[i] = authlib.BatchCheckItem{
			CorrelationID: c.correlationID,
			Verb:          c.verb,
			Group:         foldersV1.GROUP,
			Resource:      foldersV1.RESOURCE,
			Name:          name,
			Folder:        parent,
		}
	}

	batchResp, err := r.accessClient.BatchCheck(ctx, user, authlib.BatchCheckRequest{
		Namespace: ns.Value,
		Checks:    checks,
	})
	if err != nil {
		return nil, err
	}

	allowed := make(map[string]bool, len(folderTierChecks))
	for _, c := range folderTierChecks {
		result := batchResp.Results[c.correlationID]
		if result.Error != nil {
			return nil, result.Error
		}
		allowed[c.correlationID] = result.Allowed
	}

	// Can* mirrors the legacy pkg/api/folder.go newToFolderDto computation:
	// canEdit / canSave both gate on folders:write, canDelete on folders:delete,
	// canAdmin on the permissions verbs. CanAdmin implies the other three
	// because the seeded Admin role bundles those actions.
	canAdmin := allowed["setperms"]
	rsp := &foldersV1.FolderAccessInfo{
		CanAdmin:  canAdmin,
		CanEdit:   canAdmin || allowed["update"],
		CanSave:   canAdmin || allowed["update"],
		CanDelete: canAdmin || allowed["delete"],
	}

	if ac := actionsForTier(resolveTier(allowed)); len(ac) > 0 {
		rsp.AccessControl = ac
	}

	return rsp, nil
}

// resolveTier picks the highest tier the user qualifies for. Highest match
// wins: setPermissions → Admin; create/update/delete → Editor; get → Viewer.
func resolveTier(allowed map[string]bool) folderTier {
	switch {
	case allowed["setperms"]:
		return tierAdmin
	case allowed["create"] || allowed["update"] || allowed["delete"]:
		return tierEditor
	case allowed["get"]:
		return tierViewer
	default:
		return tierNone
	}
}

// actionsForTier extrapolates the full RBAC action map for the tier. The
// returned set matches what the legacy /api/folders/:uid?accesscontrol=true
// endpoint produces for a folder at View / Edit / Admin level.
func actionsForTier(tier folderTier) map[string]bool {
	var actions []string
	switch tier {
	case tierAdmin:
		actions = make([]string, 0, len(folderAdminActions)+len(dashboardAdminActions))
		actions = append(actions, folderAdminActions...)
		actions = append(actions, dashboardAdminActions...)
	case tierEditor:
		actions = make([]string, 0, len(folderEditActions)+len(dashboardEditActions))
		actions = append(actions, folderEditActions...)
		actions = append(actions, dashboardEditActions...)
	case tierViewer:
		actions = make([]string, 0, len(folderViewActions)+len(dashboardViewActions))
		actions = append(actions, folderViewActions...)
		actions = append(actions, dashboardViewActions...)
	default:
		return nil
	}

	out := make(map[string]bool, len(actions))
	for _, a := range actions {
		out[a] = true
	}
	return out
}
