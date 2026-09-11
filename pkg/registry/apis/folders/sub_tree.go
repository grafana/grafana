package folders

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	folderTreeAccessFull       = "full"
	folderTreeAccessAncestor   = "ancestor"
	folderTreeAccessNavigation = "navigation"
	folderTreeKindFolder       = "folder"
	folderTreeKindVirtual      = "virtual"
	folderTreePageSize         = int64(500)
)

type folderNavigationPurpose string

const (
	folderNavigationPurposeBrowse          folderNavigationPurpose = "browse"
	folderNavigationPurposeDashboardCreate folderNavigationPurpose = "dashboard-create"
	folderNavigationPurposeFolderEdit      folderNavigationPurpose = "folder-edit"
	folderNavigationPurposeFolderAdmin     folderNavigationPurpose = "folder-admin"
)

func parseFolderNavigationPurpose(value string) (folderNavigationPurpose, error) {
	purpose := folderNavigationPurpose(value)
	if purpose == "" {
		purpose = folderNavigationPurposeBrowse
	}
	switch purpose {
	case folderNavigationPurposeBrowse,
		folderNavigationPurposeDashboardCreate,
		folderNavigationPurposeFolderEdit,
		folderNavigationPurposeFolderAdmin:
		return purpose, nil
	default:
		return "", apierrors.NewBadRequest(fmt.Sprintf("unknown folder navigation purpose %q", value))
	}
}

func applyFolderNavigationSelectability(items []foldersv1.FolderNavigationItem, allowed map[string]bool) {
	for i := range items {
		item := &items[i]
		item.Selectable = item.Kind == folderTreeKindFolder && item.Access == folderTreeAccessFull && allowed[item.UID]
	}
}

func buildLegacyFolderNavigation(accessible []foldersv1.FolderInfo) []foldersv1.FolderNavigationItem {
	readable := make(map[string]struct{}, len(accessible))
	for _, folder := range accessible {
		readable[folder.Name] = struct{}{}
	}

	items := []foldersv1.FolderNavigationItem{{
		UID: foldermodel.SharedWithMeFolderUID, Title: "Shared with me",
		Kind: folderTreeKindVirtual, Access: folderTreeAccessNavigation,
	}}
	for _, folder := range accessible {
		parent := normalizeTreeParent(folder.Parent)
		if parent != "" {
			if _, ok := readable[parent]; !ok {
				parent = foldermodel.SharedWithMeFolderUID
			}
		}
		items = append(items, foldersv1.FolderNavigationItem{
			UID: folder.Name, Title: folder.Title, Kind: folderTreeKindFolder,
			NavigationParentUID: parent, Access: folderTreeAccessFull,
		})
	}
	return orderFolderNavigation(items)
}

func buildHierarchyFolderNavigation(
	accessible []foldersv1.FolderInfo,
	all map[string]foldersv1.FolderInfo,
	maxDepth int,
) ([]foldersv1.FolderNavigationItem, error) {
	visible := make(map[string]foldersv1.FolderNavigationItem, len(accessible))
	for _, item := range accessible {
		if item.Name == "" {
			continue
		}
		visible[item.Name] = foldersv1.FolderNavigationItem{
			UID: item.Name, Title: item.Title, Kind: folderTreeKindFolder,
			NavigationParentUID: normalizeTreeParent(item.Parent), Access: folderTreeAccessFull,
		}
	}

	depthLimit := maxDepth
	if depthLimit < 1 {
		depthLimit = 100
	}
	for _, leaf := range accessible {
		parent := normalizeTreeParent(leaf.Parent)
		seen := map[string]struct{}{leaf.Name: {}}
		for depth := 0; parent != ""; depth++ {
			if depth >= depthLimit {
				return nil, fmt.Errorf("folder tree exceeded maximum nested folder depth")
			}
			if _, exists := seen[parent]; exists {
				return nil, foldermodel.ErrCyclicReference.Errorf("cyclic folder references found: %s", parent)
			}
			seen[parent] = struct{}{}

			if existing, ok := visible[parent]; ok {
				parent = existing.NavigationParentUID
				continue
			}
			ancestor, ok := all[parent]
			if !ok {
				break
			}
			ancestorParent := normalizeTreeParent(ancestor.Parent)
			visible[parent] = foldersv1.FolderNavigationItem{
				UID: ancestor.Name, Title: ancestor.Title, Kind: folderTreeKindFolder,
				NavigationParentUID: ancestorParent, Access: folderTreeAccessAncestor,
			}
			parent = ancestorParent
		}
	}

	items := make([]foldersv1.FolderNavigationItem, 0, len(visible)+1)
	items = append(items, foldersv1.FolderNavigationItem{
		UID: foldermodel.SharedWithMeFolderUID, Title: "Shared with me",
		Kind: folderTreeKindVirtual, Access: folderTreeAccessNavigation,
	})
	for _, item := range visible {
		if item.NavigationParentUID != "" {
			if _, ok := visible[item.NavigationParentUID]; !ok {
				item.NavigationParentUID = ""
			}
		}
		items = append(items, item)
	}
	return orderFolderNavigation(items), nil
}

func orderFolderNavigation(items []foldersv1.FolderNavigationItem) []foldersv1.FolderNavigationItem {
	children := make(map[string][]foldersv1.FolderNavigationItem, len(items))
	for _, item := range items {
		children[item.NavigationParentUID] = append(children[item.NavigationParentUID], item)
	}
	for parent := range children {
		slices.SortFunc(children[parent], func(a, b foldersv1.FolderNavigationItem) int {
			if a.Kind != b.Kind {
				if a.Kind == folderTreeKindVirtual {
					return -1
				}
				return 1
			}
			if byTitle := strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title)); byTitle != 0 {
				return byTitle
			}
			return strings.Compare(a.UID, b.UID)
		})
	}
	ordered := make([]foldersv1.FolderNavigationItem, 0, len(items))
	var appendChildren func(string)
	appendChildren = func(parent string) {
		for _, item := range children[parent] {
			ordered = append(ordered, item)
			appendChildren(item.UID)
		}
	}
	appendChildren("")
	return ordered
}

type subTreeREST struct {
	searcher  resourcepb.ResourceIndexClient
	access    authlib.AccessClient
	maxDepth  int
	hierarchy bool
	metrics   *folderTreeMetrics
	topology  *folderTopologyCache
}

var _ rest.Connecter = (*subTreeREST)(nil)
var _ rest.StorageMetadata = (*subTreeREST)(nil)

func (r *subTreeREST) New() runtime.Object               { return &foldersv1.FolderNavigationList{} }
func (r *subTreeREST) Destroy()                          {}
func (r *subTreeREST) ProducesMIMETypes(string) []string { return nil }
func (r *subTreeREST) ProducesObject(string) interface{} { return &foldersv1.FolderNavigationList{} }
func (r *subTreeREST) ConnectMethods() []string          { return []string{http.MethodGet} }
func (r *subTreeREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// Connect exposes GET /apis/folder.grafana.app/{version}/namespaces/{ns}/folders/general/tree.
// The root name makes this a conventional folder subresource without reserving a real folder UID.
func (r *subTreeREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	if name != foldermodel.GeneralFolderUID {
		return nil, fmt.Errorf("folder tree is only available from the %q root", foldermodel.GeneralFolderUID)
	}

	return http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		started := time.Now()
		items, purpose, err := r.build(ctx, req.URL.Query())
		if err != nil {
			responder.Error(err)
			return
		}
		mode := "legacy"
		if r.hierarchy {
			mode = "hierarchy"
		}
		if r.metrics != nil {
			r.metrics.duration.WithLabelValues(mode, string(purpose)).Observe(time.Since(started).Seconds())
			r.metrics.items.WithLabelValues(mode, string(purpose)).Observe(float64(len(items)))
		}
		logging.FromContext(ctx).Debug("built folder navigation projection", "mode", mode, "purpose", purpose, "items", len(items), "duration", time.Since(started))
		responder.Object(http.StatusOK, &foldersv1.FolderNavigationList{Items: items})
	}), nil
}

func (r *subTreeREST) build(ctx context.Context, query url.Values) ([]foldersv1.FolderNavigationItem, folderNavigationPurpose, error) {
	purpose, err := parseFolderNavigationPurpose(query.Get("purpose"))
	if err != nil {
		return nil, "", err
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, "", err
	}

	accessible, err := r.searchFolders(ctx, ns.Value, int64(dashboardaccess.PERMISSION_VIEW))
	if err != nil {
		return nil, "", err
	}

	var items []foldersv1.FolderNavigationItem
	if r.hierarchy {
		// One service-authorized search loads compact parent links for the whole
		// namespace. Only ancestors of caller-authorized folders are emitted.
		allFolders, err := r.fullTopology(ctx, ns.OrgID, ns.Value)
		if err != nil {
			return nil, "", err
		}
		all := make(map[string]foldersv1.FolderInfo, len(allFolders))
		for _, folder := range allFolders {
			all[folder.Name] = folder
		}
		items, err = buildHierarchyFolderNavigation(accessible, all, r.maxDepth)
		if err != nil {
			return nil, "", err
		}
	} else {
		items = buildLegacyFolderNavigation(accessible)
	}

	allowed, err := r.selectableFolders(ctx, ns.Value, purpose, accessible)
	if err != nil {
		return nil, "", err
	}
	applyFolderNavigationSelectability(items, allowed)
	return items, purpose, nil
}

func (r *subTreeREST) fullTopology(ctx context.Context, orgID int64, namespace string) ([]foldersv1.FolderInfo, error) {
	loader := func(ctx context.Context) ([]foldersv1.FolderInfo, error) {
		return r.searchFolders(identity.WithServiceIdentityContext(ctx, orgID), namespace, int64(dashboardaccess.PERMISSION_VIEW))
	}
	if r.topology == nil {
		items, err := loader(ctx)
		if err != nil {
			return nil, err
		}
		return neutralFolderTopology(items), nil
	}
	return r.topology.get(ctx, folderTopologyCacheKey{orgID: orgID, namespace: namespace}, loader)
}

func treePermission(value string) int64 {
	switch strings.ToLower(value) {
	case "edit":
		return int64(dashboardaccess.PERMISSION_EDIT)
	case "admin":
		return int64(dashboardaccess.PERMISSION_ADMIN)
	default:
		return int64(dashboardaccess.PERMISSION_VIEW)
	}
}

func (r *subTreeREST) searchFolders(ctx context.Context, namespace string, permission int64) ([]foldersv1.FolderInfo, error) {
	gvr := foldersv1.FolderResourceInfo.GroupVersionResource()
	var items []foldersv1.FolderInfo
	var after []string

	for page := 0; page < 10000; page++ {
		resp, err := r.searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     gvr.Group,
				Resource:  gvr.Resource,
			}},
			Fields:      []string{resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_FOLDER},
			Limit:       folderTreePageSize,
			Permission:  permission,
			SortBy:      []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}},
			SearchAfter: after,
		})
		if err != nil {
			return nil, err
		}
		if resp.Error != nil {
			return nil, resource.GetError(resp.Error)
		}
		if resp.Results == nil || len(resp.Results.Rows) == 0 {
			return items, nil
		}

		titleIdx, parentIdx := -1, -1
		for i, column := range resp.Results.Columns {
			switch column.Name {
			case resource.SEARCH_FIELD_TITLE:
				titleIdx = i
			case resource.SEARCH_FIELD_FOLDER:
				parentIdx = i
			}
		}
		for _, row := range resp.Results.Rows {
			if row.Key == nil {
				continue
			}
			item := foldersv1.FolderInfo{Name: row.Key.Name, Access: folderTreeAccessFull}
			if titleIdx >= 0 && titleIdx < len(row.Cells) {
				item.Title = string(row.Cells[titleIdx])
			}
			if parentIdx >= 0 && parentIdx < len(row.Cells) {
				item.Parent = normalizeTreeParent(string(row.Cells[parentIdx]))
			}
			items = append(items, item)
		}

		last := resp.Results.Rows[len(resp.Results.Rows)-1]
		if len(resp.Results.Rows) < int(folderTreePageSize) {
			return items, nil
		}
		if len(last.SortFields) == 0 {
			return nil, fmt.Errorf("folder tree search did not return a pagination cursor")
		}
		after = last.SortFields
	}
	return nil, fmt.Errorf("folder tree search exceeded pagination safety limit")
}

func (r *subTreeREST) selectableFolders(
	ctx context.Context,
	namespace string,
	purpose folderNavigationPurpose,
	accessible []foldersv1.FolderInfo,
) (map[string]bool, error) {
	allowed := make(map[string]bool, len(accessible))
	if purpose == folderNavigationPurposeBrowse {
		for _, folder := range accessible {
			allowed[folder.Name] = true
		}
		return allowed, nil
	}
	if len(accessible) == 0 {
		return allowed, nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	checks := make([]authlib.BatchCheckItem, 0, len(accessible))
	uidByCorrelationID := make(map[string]string, len(accessible))
	for i, folder := range accessible {
		correlationID := fmt.Sprintf("folder-%d", i)
		check := authlib.BatchCheckItem{CorrelationID: correlationID}
		switch purpose {
		case folderNavigationPurposeDashboardCreate:
			check.Verb = utils.VerbCreate
			check.Group = dashboardv1.GROUP
			check.Resource = dashboardv1.DASHBOARD_RESOURCE
			check.Folder = folder.Name
		case folderNavigationPurposeFolderEdit:
			check.Verb = utils.VerbUpdate
			check.Group = foldersv1.GROUP
			check.Resource = foldersv1.RESOURCE
			check.Name = folder.Name
			check.Folder = normalizeTreeParent(folder.Parent)
		case folderNavigationPurposeFolderAdmin:
			check.Verb = utils.VerbSetPermissions
			check.Group = foldersv1.GROUP
			check.Resource = foldersv1.RESOURCE
			check.Name = folder.Name
			check.Folder = normalizeTreeParent(folder.Parent)
		}
		checks = append(checks, check)
		uidByCorrelationID[correlationID] = folder.Name
	}
	response, err := r.access.BatchCheck(ctx, user, authlib.BatchCheckRequest{Namespace: namespace, Checks: checks})
	if err != nil {
		return nil, err
	}
	for correlationID, uid := range uidByCorrelationID {
		result, ok := response.Results[correlationID]
		if !ok {
			return nil, fmt.Errorf("folder navigation access check returned no result for %q", uid)
		}
		if result.Error != nil {
			return nil, result.Error
		}
		allowed[uid] = result.Allowed
	}
	return allowed, nil
}

type folderTreeMetrics struct {
	duration *prometheus.HistogramVec
	items    *prometheus.HistogramVec
}

func newFolderTreeMetrics(registerer prometheus.Registerer) *folderTreeMetrics {
	metrics := &folderTreeMetrics{
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana", Subsystem: "folder_navigation", Name: "projection_duration_seconds",
			Help: "Time spent building an authorization-aware folder navigation projection.",
		}, []string{"mode", "purpose"}),
		items: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana", Subsystem: "folder_navigation", Name: "projection_items",
			Help: "Number of items in an authorization-aware folder navigation projection.",
		}, []string{"mode", "purpose"}),
	}
	registerer.MustRegister(metrics.duration, metrics.items)
	return metrics
}

type folderInfoLookup func(uid string) (*foldersv1.FolderInfo, error)

func buildFolderTree(accessible []foldersv1.FolderInfo, maxDepth int, lookup folderInfoLookup) ([]foldersv1.FolderInfo, error) {
	visible := make(map[string]foldersv1.FolderInfo, len(accessible))
	for _, item := range accessible {
		if item.Name == "" {
			continue
		}
		item.Parent = normalizeTreeParent(item.Parent)
		item.Description = ""
		item.Detached = false
		item.Access = folderTreeAccessFull
		visible[item.Name] = item
	}

	depthLimit := maxDepth
	if depthLimit < 1 {
		depthLimit = 100
	}
	for _, leaf := range accessible {
		parent := normalizeTreeParent(leaf.Parent)
		seen := map[string]struct{}{leaf.Name: {}}
		for depth := 0; parent != ""; depth++ {
			if depth >= depthLimit {
				return nil, fmt.Errorf("folder tree exceeded maximum nested folder depth")
			}
			if _, exists := seen[parent]; exists {
				return nil, foldermodel.ErrCyclicReference.Errorf("cyclic folder references found: %s", parent)
			}
			seen[parent] = struct{}{}

			if existing, ok := visible[parent]; ok {
				parent = normalizeTreeParent(existing.Parent)
				continue
			}
			ancestor, err := lookup(parent)
			if err != nil {
				// A concurrent move/delete can detach the leaf. Keep the authorized
				// leaf, but do not fabricate or disclose a missing ancestor.
				if apierrors.IsNotFound(err) {
					break
				}
				return nil, fmt.Errorf("get projected folder ancestor: %w", err)
			}
			ancestor.Parent = normalizeTreeParent(ancestor.Parent)
			ancestor.Description = ""
			ancestor.Detached = false
			ancestor.Access = folderTreeAccessAncestor
			visible[ancestor.Name] = *ancestor
			parent = ancestor.Parent
		}
	}

	return orderFolderTree(visible), nil
}

func normalizeTreeParent(parent string) string {
	if foldermodel.IsRootFolderUID(parent) {
		return ""
	}
	return parent
}

func orderFolderTree(visible map[string]foldersv1.FolderInfo) []foldersv1.FolderInfo {
	children := make(map[string][]foldersv1.FolderInfo, len(visible))
	for _, item := range visible {
		parent := item.Parent
		if _, exists := visible[parent]; !exists {
			parent = ""
			item.Parent = ""
		}
		children[parent] = append(children[parent], item)
	}
	for parent := range children {
		slices.SortFunc(children[parent], func(a, b foldersv1.FolderInfo) int {
			if byTitle := strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title)); byTitle != 0 {
				return byTitle
			}
			return strings.Compare(a.Name, b.Name)
		})
	}

	ordered := make([]foldersv1.FolderInfo, 0, len(visible))
	var appendChildren func(string)
	appendChildren = func(parent string) {
		for _, item := range children[parent] {
			ordered = append(ordered, item)
			appendChildren(item.Name)
		}
	}
	appendChildren("")
	return ordered
}
