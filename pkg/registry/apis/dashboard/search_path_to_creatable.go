package dashboard

import (
	"context"
	"net/url"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	commonv0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	includePathToCreatable = "pathToCreatable"

	// Past this many creatable folders the user can save almost anywhere, so hiding folders gains little
	// and the result could be cut short by the search scan budget.
	pathToCreatableLimit = 1000
	// Bounds the walk up the folder tree, which is shallower than this by default.
	pathToCreatableMaxDepth = 10
)

// creatablePath is the folders a user can save dashboards into and the folders that lead to them.
type creatablePath struct {
	creatable map[string]struct{}
	reachable map[string]struct{}
}

// wantsPathToCreatable reports whether the request asks to only list folders on the way to a creatable one.
// It is ignored while permission=create is not served, as there is nothing to compute it from.
func wantsPathToCreatable(ctx context.Context, queryParams url.Values) (bool, error) {
	if !slices.Contains(queryParams["include"], includePathToCreatable) {
		return false, nil
	}
	if types := queryParams["type"]; len(types) != 1 || types[0] != "folder" {
		return false, apierrors.NewBadRequest("include=" + includePathToCreatable + " is only supported with type=folder")
	}
	return effectivePermission(ctx, dashboardaccess.PERMISSION_CREATE) == dashboardaccess.PERMISSION_CREATE, nil
}

// searchHits runs a search and parses its hits.
func (s *SearchHandler) searchHits(ctx context.Context, req *resourcepb.ResourceSearchRequest) ([]dashboardv0alpha1.DashboardHit, error) {
	result, err := s.client.Search(ctx, req)
	if err := resource.StatusErrorFromResponse(result.GetError(), err); err != nil {
		return nil, err
	}
	parsed, err := dashboardsearch.ParseResults(result, 0)
	if err != nil {
		return nil, err
	}
	return parsed.Hits, nil
}

// creatablePath finds the folders the user can create dashboards in, then walks up their parents.
// It returns nil when there are too many creatable folders to be worth filtering by.
func (s *SearchHandler) creatablePath(ctx context.Context, user identity.Requester) (*creatablePath, error) {
	folderKey, err := asResourceKey(user.GetNamespace(), folders.RESOURCE)
	if err != nil {
		return nil, err
	}

	hits, err := s.searchHits(ctx, &resourcepb.ResourceSearchRequest{
		Fields:       []string{resource.SEARCH_FIELD_FOLDER},
		Limit:        pathToCreatableLimit + 1,
		Permission:   int64(dashboardaccess.PERMISSION_CREATE),
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Options:      &resourcepb.ListOptions{Key: folderKey},
	})
	if err != nil {
		return nil, err
	}
	if len(hits) > pathToCreatableLimit {
		return nil, nil
	}

	path := &creatablePath{creatable: map[string]struct{}{}, reachable: map[string]struct{}{}}
	for _, hit := range hits {
		path.creatable[hit.Name] = struct{}{}
		path.reachable[hit.Name] = struct{}{}
	}

	frontier := path.unseenParents(hits)
	for depth := 0; len(frontier) > 0 && depth < pathToCreatableMaxDepth; depth++ {
		// Viewing is enough to be listed as a way to a creatable folder
		parents, err := s.searchHits(ctx, nameLookupRequest(folderKey, frontier, dashboardaccess.PERMISSION_VIEW))
		if err != nil {
			return nil, err
		}
		for _, parent := range parents {
			path.reachable[parent.Name] = struct{}{}
		}
		frontier = path.unseenParents(parents)
	}
	return path, nil
}

// unseenParents returns the parent folders of the hits that are not yet reachable, without the root.
func (p *creatablePath) unseenParents(hits []dashboardv0alpha1.DashboardHit) []string {
	var parents []string
	for _, hit := range hits {
		if foldermodel.IsRootFolderUID(hit.Folder) || slices.Contains(parents, hit.Folder) {
			continue
		}
		if _, seen := p.reachable[hit.Folder]; !seen {
			parents = append(parents, hit.Folder)
		}
	}
	return parents
}

func (p *creatablePath) reachableNames() []string {
	names := make([]string, 0, len(p.reachable))
	for name := range p.reachable {
		names = append(names, name)
	}
	return names
}

// markCreatable records on each hit whether the user can create dashboards in the folder, as opposed to it
// only leading to one.
func (p *creatablePath) markCreatable(hits []dashboardv0alpha1.DashboardHit) {
	for i := range hits {
		if hits[i].Field == nil {
			hits[i].Field = &commonv0.Unstructured{}
		}
		_, ok := p.creatable[hits[i].Name]
		hits[i].Field.Set("canCreate", ok)
	}
}
