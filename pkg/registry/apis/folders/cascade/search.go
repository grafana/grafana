package cascade

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// defaultSearchPageSize bounds each search page when listing a folder's children.
const defaultSearchPageSize int64 = 1000

var (
	folderGVR    = foldersv1.FolderResourceInfo.GroupVersionResource()
	dashboardGVR = dashv1.DashboardResourceInfo.GroupVersionResource()
)

// searchChildLister finds direct children through the unified search index.
type searchChildLister struct {
	searcher resourcepb.ResourceIndexClient
	pageSize int64
}

// NewSearchChildLister lists direct children via searcher; pageSize <= 0 uses the default.
func NewSearchChildLister(searcher resourcepb.ResourceIndexClient, pageSize int64) ChildLister {
	if pageSize <= 0 {
		pageSize = defaultSearchPageSize
	}
	return &searchChildLister{searcher: searcher, pageSize: pageSize}
}

// DirectChildren returns subfolders first, then dashboards.
func (l *searchChildLister) DirectChildren(ctx context.Context, namespace, folderUID string) ([]Child, error) {
	var out []Child
	for _, k := range []struct {
		kind ChildKind
		gvr  schema.GroupVersionResource
	}{{ChildFolder, folderGVR}, {ChildDashboard, dashboardGVR}} {
		names, err := l.namesInFolder(ctx, namespace, folderUID, k.gvr)
		if err != nil {
			return nil, fmt.Errorf("search %s in folder %q: %w", k.kind, folderUID, err)
		}
		for _, n := range names {
			out = append(out, Child{Kind: k.kind, Name: n})
		}
	}
	return out, nil
}

// namesInFolder pages through every gvr object whose folder is folderUID. The full set is listed
// before anything is deleted, since offset paging is only valid against a stable collection.
func (l *searchChildLister) namesInFolder(ctx context.Context, namespace, folderUID string, gvr schema.GroupVersionResource) ([]string, error) {
	var (
		names  []string
		offset int64
	)
	for {
		resp, err := l.searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{Namespace: namespace, Group: gvr.Group, Resource: gvr.Resource},
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_FOLDER,
					Operator: string(selection.Equals),
					Values:   []string{folderUID},
				}},
			},
			Fields:       []string{resource.SEARCH_FIELD_NAME},
			Limit:        l.pageSize,
			Offset:       offset,
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		})
		if err := resource.StatusErrorFromResponse(resp.GetError(), err); err != nil {
			return nil, err
		}
		rows := resp.GetRows()
		for _, row := range rows {
			if row.GetKey() != nil {
				names = append(names, row.GetKey().GetName())
			}
		}
		// Advance by the rows actually returned so a short page doesn't skip the remainder.
		offset += int64(len(rows))
		if len(rows) == 0 || offset >= resp.GetTotalHits() {
			return names, nil
		}
	}
}
