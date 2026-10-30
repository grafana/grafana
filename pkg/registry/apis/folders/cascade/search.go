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

var (
	folderGVR    = foldersv1.FolderResourceInfo.GroupVersionResource()
	dashboardGVR = dashv1.DashboardResourceInfo.GroupVersionResource()
)

// searchChildLister finds direct children through the unified search index.
type searchChildLister struct {
	searcher resourcepb.ResourceIndexClient
}

// NewSearchChildLister lists direct children via searcher.
func NewSearchChildLister(searcher resourcepb.ResourceIndexClient) ChildLister {
	return &searchChildLister{searcher: searcher}
}

func (l *searchChildLister) ListChildren(ctx context.Context, namespace, folderUID string, kind ChildKind, offset, limit int64) ([]Child, int64, error) {
	var gvr schema.GroupVersionResource
	switch kind {
	case ChildFolder:
		gvr = folderGVR
	case ChildDashboard:
		gvr = dashboardGVR
	default:
		return nil, 0, fmt.Errorf("unsupported child kind %q", kind)
	}

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
		Limit:        limit,
		Offset:       offset,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	})
	if err := resource.StatusErrorFromResponse(resp.GetError(), err); err != nil {
		return nil, 0, fmt.Errorf("search %s in folder %q: %w", kind, folderUID, err)
	}
	// Rows in another format are not decoded here, so they must not read as an empty folder.
	if f := resp.GetResultFormat(); f != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return nil, 0, fmt.Errorf("search %s in folder %q: unexpected search result format %s", kind, folderUID, f)
	}
	children := make([]Child, 0, len(resp.GetRows()))
	for _, row := range resp.GetRows() {
		if row.GetKey() != nil {
			children = append(children, Child{Kind: kind, Name: row.GetKey().GetName()})
		}
	}
	return children, resp.GetTotalHits(), nil
}
