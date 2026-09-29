package folders

import (
	"context"
	"net/http"

	"golang.org/x/sync/errgroup"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
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

// API groups probed below. Spelled out rather than imported so the apiserver
// edge does not depend on every app's registration package.
const (
	dashboardGroup     = "dashboard.grafana.app"
	alertRulesGroup    = "rules.alerting.grafana.app"
	notificationsGroup = "notifications.alerting.grafana.app"
)

// folderProbe is one item sent to BatchCheck. Each probe asks a single yes/no
// question and, when allowed, contributes exactly one RBAC action to the
// AccessControl map.
//
// The CorrelationID must match the [\w-]{1,36} regex enforced downstream, so we
// use a short stable slug instead of the "domain:verb" action key.
type folderProbe struct {
	correlationID string
	group         string
	resource      string
	subresource   string
	verb          string
	// action is the RBAC action key this probe contributes to AccessControl.
	action string
	// inFolder asks "may the user do this to a resource inside this folder"
	// (empty Name, Folder set to this folder's UID). When false the probe asks
	// about the folder object itself (Name is the folder UID, Folder is its
	// parent).
	//
	// Folder-scoped questions with an empty Name are only honoured for
	// resources whose mapper translation sets folderSupport — otherwise the
	// check falls back to "does the user hold this action anywhere in the
	// namespace". Every resource probed below has folder support. See
	// checkPermissionWithMapping in pkg/services/authz/rbac/service.go.
	inFolder bool
}

// item builds the BatchCheck item for folder `name`, using `parent` as the
// folder hint for probes about the folder object itself.
func (p folderProbe) item(name, parent string) authlib.BatchCheckItem {
	item := authlib.BatchCheckItem{
		CorrelationID: p.correlationID,
		Verb:          p.verb,
		Group:         p.group,
		Resource:      p.resource,
		Subresource:   p.subresource,
	}
	if p.inFolder {
		item.Folder = name
	} else {
		item.Name = name
		item.Folder = parent
	}
	return item
}

// folderAccessProbes covers every action the legacy
// /api/folders/:uid?accesscontrol=true endpoint could report for a folder, so
// the response is the user's real permission set rather than a bundle inferred
// from their folder role. The action list mirrors FolderViewActions /
// FolderEditActions / FolderAdminActions and their dashboard and notebook
// counterparts in pkg/services/accesscontrol/ossaccesscontrol/; keep in sync if
// those bundles gain actions.
var folderAccessProbes = []folderProbe{
	// This folder object.
	{correlationID: "folder-get", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbGet, action: "folders:read"},
	{correlationID: "folder-write", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbUpdate, action: "folders:write"},
	{correlationID: "folder-delete", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbDelete, action: "folders:delete"},
	{correlationID: "folder-getperms", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbGetPermissions, action: "folders.permissions:read"},
	{correlationID: "folder-setperms", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbSetPermissions, action: "folders.permissions:write"},

	// Subfolders.
	{correlationID: "folder-create", group: foldersV1.GROUP, resource: foldersV1.RESOURCE, verb: utils.VerbCreate, action: "folders:create", inFolder: true},

	// Dashboards in this folder.
	{correlationID: "dash-read", group: dashboardGroup, resource: "dashboards", verb: utils.VerbGet, action: "dashboards:read", inFolder: true},
	{correlationID: "dash-create", group: dashboardGroup, resource: "dashboards", verb: utils.VerbCreate, action: "dashboards:create", inFolder: true},
	{correlationID: "dash-write", group: dashboardGroup, resource: "dashboards", verb: utils.VerbUpdate, action: "dashboards:write", inFolder: true},
	{correlationID: "dash-delete", group: dashboardGroup, resource: "dashboards", verb: utils.VerbDelete, action: "dashboards:delete", inFolder: true},
	{correlationID: "dash-getperms", group: dashboardGroup, resource: "dashboards", verb: utils.VerbGetPermissions, action: "dashboards.permissions:read", inFolder: true},
	{correlationID: "dash-setperms", group: dashboardGroup, resource: "dashboards", verb: utils.VerbSetPermissions, action: "dashboards.permissions:write", inFolder: true},

	// Annotations are a dashboard subresource.
	{correlationID: "anno-read", group: dashboardGroup, resource: "dashboards", subresource: "annotations", verb: utils.VerbGet, action: "annotations:read", inFolder: true},
	{correlationID: "anno-create", group: dashboardGroup, resource: "dashboards", subresource: "annotations", verb: utils.VerbCreate, action: "annotations:create", inFolder: true},
	{correlationID: "anno-write", group: dashboardGroup, resource: "dashboards", subresource: "annotations", verb: utils.VerbUpdate, action: "annotations:write", inFolder: true},
	{correlationID: "anno-delete", group: dashboardGroup, resource: "dashboards", subresource: "annotations", verb: utils.VerbDelete, action: "annotations:delete", inFolder: true},

	// Library panels in this folder.
	{correlationID: "libpanel-read", group: dashboardGroup, resource: "librarypanels", verb: utils.VerbGet, action: "library.panels:read", inFolder: true},
	{correlationID: "libpanel-create", group: dashboardGroup, resource: "librarypanels", verb: utils.VerbCreate, action: "library.panels:create", inFolder: true},
	{correlationID: "libpanel-write", group: dashboardGroup, resource: "librarypanels", verb: utils.VerbUpdate, action: "library.panels:write", inFolder: true},
	{correlationID: "libpanel-delete", group: dashboardGroup, resource: "librarypanels", verb: utils.VerbDelete, action: "library.panels:delete", inFolder: true},

	// Variables in this folder.
	{correlationID: "var-read", group: dashboardGroup, resource: "variables", verb: utils.VerbGet, action: "variables:read", inFolder: true},
	{correlationID: "var-create", group: dashboardGroup, resource: "variables", verb: utils.VerbCreate, action: "variables:create", inFolder: true},
	{correlationID: "var-write", group: dashboardGroup, resource: "variables", verb: utils.VerbUpdate, action: "variables:write", inFolder: true},
	{correlationID: "var-delete", group: dashboardGroup, resource: "variables", verb: utils.VerbDelete, action: "variables:delete", inFolder: true},

	// Notebooks in this folder. There is no per-notebook permissions management,
	// so no permission verbs are probed.
	{correlationID: "notebook-read", group: dashboardGroup, resource: "notebooks", verb: utils.VerbGet, action: "notebooks:read", inFolder: true},
	{correlationID: "notebook-create", group: dashboardGroup, resource: "notebooks", verb: utils.VerbCreate, action: "notebooks:create", inFolder: true},
	{correlationID: "notebook-write", group: dashboardGroup, resource: "notebooks", verb: utils.VerbUpdate, action: "notebooks:write", inFolder: true},
	{correlationID: "notebook-delete", group: dashboardGroup, resource: "notebooks", verb: utils.VerbDelete, action: "notebooks:delete", inFolder: true},

	// Alert rules in this folder.
	{correlationID: "rule-read", group: alertRulesGroup, resource: "alertrules", verb: utils.VerbGet, action: "alert.rules:read", inFolder: true},
	{correlationID: "rule-create", group: alertRulesGroup, resource: "alertrules", verb: utils.VerbCreate, action: "alert.rules:create", inFolder: true},
	{correlationID: "rule-write", group: alertRulesGroup, resource: "alertrules", verb: utils.VerbUpdate, action: "alert.rules:write", inFolder: true},
	{correlationID: "rule-delete", group: alertRulesGroup, resource: "alertrules", verb: utils.VerbDelete, action: "alert.rules:delete", inFolder: true},

	// Silences for this folder's rules. There is no alert.silences:delete action.
	{correlationID: "silence-read", group: notificationsGroup, resource: "silences", verb: utils.VerbGet, action: "alert.silences:read", inFolder: true},
	{correlationID: "silence-create", group: notificationsGroup, resource: "silences", verb: utils.VerbCreate, action: "alert.silences:create", inFolder: true},
	{correlationID: "silence-write", group: notificationsGroup, resource: "silences", verb: utils.VerbUpdate, action: "alert.silences:write", inFolder: true},
}

// probeBatch is the set of probes sharing one group/resource/subresource.
type probeBatch struct {
	probes []folderProbe
}

// folderAccessProbeBatches splits the probes by group/resource/subresource
// because rolloutAccessClient picks one backend per BatchCheck call from the
// first item, and falls back to RBAC for the whole batch when the items
// disagree. Sending one homogeneous batch per resource keeps each call
// routable, so folders participating in a Zanzana rollout are still answered
// by Zanzana.
var folderAccessProbeBatches = batchProbesByResource(folderAccessProbes)

// maxConcurrentProbeBatches bounds the fan-out below. The authz server admits
// requests with a non-blocking semaphore and rejects the overflow with
// ResourceExhausted (zanzana.server.max_concurrent_requests_per_namespace), so
// a single /access call should not try to occupy every slot a tenant has.
const maxConcurrentProbeBatches = 4

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*foldersV1.FolderAccessInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// sharedwithme is a virtual aggregation view with no RBAC scope and nothing
	// to act on, so report no access instead of probing for a missing object.
	if name == folder.SharedWithMeFolderUID {
		return &foldersV1.FolderAccessInfo{}, nil
	}

	// The root folder has no stored object to Get and no parent. Normalise the
	// legacy empty UID to "general" so authz resolves the folders:uid:general
	// scope, matching legacy /api/folders/general?accesscontrol=true.
	if folder.IsRootFolderUID(name) {
		return r.checkAccess(ctx, ns.Value, user, folder.GeneralFolderUID, "")
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

	return r.checkAccess(ctx, ns.Value, user, name, parent)
}

// checkAccess runs every probe for folder `name` (with `parent` as the folder
// hint for object-level probes) and assembles the FolderAccessInfo, mirroring
// legacy newToFolderDto in pkg/api/folder.go.
func (r *subAccessREST) checkAccess(ctx context.Context, namespace string, user identity.Requester, name, parent string) (*foldersV1.FolderAccessInfo, error) {
	// The batches are independent, so they run concurrently and the endpoint
	// costs a few round trips rather than one per resource.
	responses := make([]authlib.BatchCheckResponse, len(folderAccessProbeBatches))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentProbeBatches)
	for i, batch := range folderAccessProbeBatches {
		g.Go(func() error {
			checks := make([]authlib.BatchCheckItem, len(batch.probes))
			for j, p := range batch.probes {
				checks[j] = p.item(name, parent)
			}
			resp, err := r.accessClient.BatchCheck(gctx, user, authlib.BatchCheckRequest{
				Namespace: namespace,
				Checks:    checks,
			})
			if err != nil {
				return err
			}
			responses[i] = resp
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	allowed := make(map[string]bool, len(folderAccessProbes))
	accessControl := make(map[string]bool, len(folderAccessProbes))
	for i, batch := range folderAccessProbeBatches {
		for _, p := range batch.probes {
			result := responses[i].Results[p.correlationID]
			if result.Error != nil {
				return nil, result.Error
			}
			allowed[p.correlationID] = result.Allowed
			if result.Allowed {
				accessControl[p.action] = true
			}
		}
	}

	// Can* mirrors the legacy pkg/api/folder.go newToFolderDto computation:
	// canEdit / canSave both gate on folders:write, canDelete on folders:delete,
	// canAdmin on holding both permissions verbs. The flags are independent —
	// the seeded Admin role bundles all of these actions, but a custom role
	// granting only the permissions verbs must not report edit, save or delete.
	rsp := &foldersV1.FolderAccessInfo{
		CanAdmin:  allowed["folder-getperms"] && allowed["folder-setperms"],
		CanEdit:   allowed["folder-write"],
		CanSave:   allowed["folder-write"],
		CanDelete: allowed["folder-delete"],
	}

	if len(accessControl) > 0 {
		rsp.AccessControl = accessControl
	}

	return rsp, nil
}

// batchProbesByResource groups probes that share a group/resource/subresource,
// preserving the order they are declared in. The subresource is part of the key
// because the rollout map treats it as a distinct routable resource.
func batchProbesByResource(probes []folderProbe) []probeBatch {
	var batches []probeBatch
	index := make(map[string]int)
	for _, p := range probes {
		key := p.group + "/" + p.resource + "/" + p.subresource
		i, ok := index[key]
		if !ok {
			i = len(batches)
			index[key] = i
			batches = append(batches, probeBatch{})
		}
		batches[i].probes = append(batches[i].probes, p)
	}
	return batches
}
