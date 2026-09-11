package folders

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

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
	folderTreeAccessFull     = "full"
	folderTreeAccessAncestor = "ancestor"
	folderTreePageSize       = int64(500)
)

type subTreeREST struct {
	getter   rest.Getter
	searcher resourcepb.ResourceIndexClient
	maxDepth int
}

var _ rest.Connecter = (*subTreeREST)(nil)
var _ rest.StorageMetadata = (*subTreeREST)(nil)

func (r *subTreeREST) New() runtime.Object               { return &foldersv1.FolderInfoList{} }
func (r *subTreeREST) Destroy()                          {}
func (r *subTreeREST) ProducesMIMETypes(string) []string { return nil }
func (r *subTreeREST) ProducesObject(string) interface{} { return &foldersv1.FolderInfoList{} }
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
		items, err := r.build(ctx, req.URL.Query())
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, &foldersv1.FolderInfoList{Items: items})
	}), nil
}

func (r *subTreeREST) build(ctx context.Context, query url.Values) ([]foldersv1.FolderInfo, error) {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	accessible, err := r.searchAccessible(ctx, ns.Value, treePermission(query.Get("permission")))
	if err != nil {
		return nil, err
	}

	// Only exact parents named by already-authorized resources are read with the
	// service identity. It is deliberately never used to list children.
	serviceCtx := identity.WithServiceIdentityContext(ctx, ns.OrgID)
	return buildFolderTree(accessible, r.maxDepth, func(uid string) (*foldersv1.FolderInfo, error) {
		obj, err := r.getter.Get(serviceCtx, uid, &metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		folder, ok := obj.(*foldersv1.Folder)
		if !ok {
			return nil, fmt.Errorf("expected folder, found %T", obj)
		}
		meta, err := utils.MetaAccessor(folder)
		if err != nil {
			return nil, err
		}
		return &foldersv1.FolderInfo{Name: folder.Name, Title: folder.Spec.Title, Parent: meta.GetFolder()}, nil
	})
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

func (r *subTreeREST) searchAccessible(ctx context.Context, namespace string, permission int64) ([]foldersv1.FolderInfo, error) {
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
