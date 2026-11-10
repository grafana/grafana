package dashboard

import (
	"context"
	"net/url"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apimachinery/pkg/selection"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (s *SearchHandler) WithCreatableTree(perms userPermissionsGetter, folders folder.Service) *SearchHandler {
	s.creatable = NewCreatableTreeCache(perms, folders)
	s.folders = folders
	return s
}

// narrowCreatable limits a permission=create folder search to children that are, or lead to,
// a create grant. On error the request is left untouched.
func (s *SearchHandler) narrowCreatable(ctx context.Context, user identity.Requester, queryParams url.Values, req *resourcepb.ResourceSearchRequest) (flag func([]dashboardv0alpha1.DashboardHit), empty bool, err error) {
	parent := queryParams.Get("folder")
	if s.creatable == nil || parent == "" || parent == folder.SharedWithMeFolderUID || len(queryParams["name"]) > 0 ||
		permissionFromQueryParams(queryParams) != dashboardaccess.PERMISSION_CREATE ||
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

	// The index already create-checks every child.
	if tree.Inherited(path) {
		return func(hits []dashboardv0alpha1.DashboardHit) { setCanCreate(hits, func(string) bool { return true }) }, false, nil
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
	return func(hits []dashboardv0alpha1.DashboardHit) { setCanCreate(hits, tree.IsGrant) }, false, nil
}

func setCanCreate(hits []dashboardv0alpha1.DashboardHit, can func(uid string) bool) {
	for i := range hits {
		v := can(hits[i].Name)
		hits[i].CanCreate = &v
	}
}
