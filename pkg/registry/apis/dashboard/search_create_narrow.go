package dashboard

import (
	"context"
	"net/url"
	"slices"

	"github.com/open-feature/go-sdk/openfeature"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/selection"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const includePathToCreatable = "pathToCreatable"

func (s *SearchHandler) WithCreatableTree(perms userPermissionsGetter, folders folder.Service) *SearchHandler {
	s.creatable = NewCreatableTreeCache(perms, folders)
	s.folders = folders
	return s
}

type creatableNarrowing struct {
	tree      *CreatableTree
	inherited bool
	grants    []string // children of the parent holding a grant
}

// narrowCreatable limits a permission=create folder search to children that are, or lead to,
// a create grant. On error the request is left untouched.
func (s *SearchHandler) narrowCreatable(ctx context.Context, user identity.Requester, queryParams url.Values, req *resourcepb.ResourceSearchRequest) (n *creatableNarrowing, empty bool, err error) {
	parent := queryParams.Get("folder")
	types := queryParams["type"]
	if s.creatable == nil || parent == "" || parent == folder.SharedWithMeFolderUID || len(queryParams["name"]) > 0 ||
		!slices.Contains(queryParams["include"], includePathToCreatable) || len(types) != 1 || types[0] != "folder" ||
		effectivePermission(ctx, dashboardaccess.PERMISSION_CREATE) != dashboardaccess.PERMISSION_CREATE ||
		!openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagFolderPickerCreatableFolderTree, false, openfeature.TransactionContext(ctx)) {
		return nil, false, nil
	}

	path, err := FolderPath(ctx, s.folders, user.GetOrgID(), parent)
	if err != nil {
		return nil, false, err
	}
	tree, err := s.creatable.Get(ctx, user)
	if err != nil {
		return nil, false, err
	}

	// Have the index create-check every child.
	if tree.Inherited(path) {
		req.Permission = int64(dashboardaccess.PERMISSION_CREATE)
		return &creatableNarrowing{tree: tree, inherited: true}, false, nil
	}

	children := tree.Children(parent)
	if len(children) == 0 {
		return nil, true, nil
	}
	// Read, since folders leading to a grant are not creatable themselves.
	req.Permission = 0
	req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
		Key:      "name",
		Operator: string(selection.In),
		Values:   children,
	})
	n = &creatableNarrowing{tree: tree}
	for _, c := range children {
		if tree.IsGrant(c) {
			n.grants = append(n.grants, c)
		}
	}
	return n, false, nil
}

// addCreateOnly appends granted children the read search could not return because the
// user can create in them but not read them. It only runs when the read page is complete.
func (s *SearchHandler) addCreateOnly(ctx context.Context, n *creatableNarrowing, req *resourcepb.ResourceSearchRequest, res *dashboardv0alpha1.SearchResults) error {
	if n.inherited || req.Offset != 0 || int64(len(res.Hits)) >= req.Limit {
		return nil
	}
	found := make(map[string]struct{}, len(res.Hits))
	for _, h := range res.Hits {
		found[h.Name] = struct{}{}
	}
	var missing []string
	for _, g := range n.grants {
		if _, ok := found[g]; !ok {
			missing = append(missing, g)
		}
	}
	if len(missing) == 0 {
		return nil
	}

	createReq := proto.Clone(req).(*resourcepb.ResourceSearchRequest)
	createReq.Permission = int64(dashboardaccess.PERMISSION_CREATE)
	for _, f := range createReq.Options.Fields {
		if f.Key == "name" {
			f.Values = missing
		}
	}
	result, err := s.client.Search(ctx, createReq)
	if err != nil {
		return err
	}
	extra, err := dashboardsearch.ParseResults(result, 0)
	if err != nil {
		return err
	}
	res.Hits = append(res.Hits, extra.Hits...)
	res.TotalHits += int64(len(extra.Hits))
	return nil
}

// flag sets field.canCreate on the hits.
func (n *creatableNarrowing) flag(hits []dashboardv0alpha1.DashboardHit) {
	for i := range hits {
		hits[i].Field.Set("canCreate", n.inherited || n.tree.IsGrant(hits[i].Name))
	}
}
