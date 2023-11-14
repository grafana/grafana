package dashboards

import (
	"context"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	// _ rest.Creater              = (*legacyStorage)(nil)
	// _ rest.Updater              = (*legacyStorage)(nil)
	// _ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	store      *genericregistry.Store
	builder    *DashboardsAPIBuilder
	namespacer request.NamespaceMapper
}

func (s *legacyStorage) New() runtime.Object {
	return &dashboards.DashboardResource{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return "dashboard"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &dashboards.DashboardInfoList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user := appcontext.MustUser(ctx)
	limit := int64(1000)
	if options.Limit > 0 {
		limit = options.Limit
	}
	res, err := s.builder.dashboardService.SearchDashboards(ctx, &dashboardssvc.FindPersistedDashboardsQuery{
		SignedInUser: user,
		OrgId:        info.OrgID,
		Limit:        limit,
		// Page: options.Continue, ???
	})
	if err != nil {
		return nil, err
	}

	list := &dashboards.DashboardInfoList{}
	for _, v := range res {
		info := dashboards.DashboardInfo{
			ObjectMeta: metav1.ObjectMeta{
				Name: v.UID,
			},
			Title: v.Title,
			Tags:  v.Tags,
		}
		list.Items = append(list.Items, info)
	}
	if len(list.Items) == int(limit) {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dto, err := s.builder.dashboardService.GetDashboard(ctx, &dashboardssvc.GetDashboardQuery{
		UID:   name,
		OrgID: info.OrgID,
	})
	if err != nil || dto == nil {
		if true { // errors.Is(err, playlistsvc.ErrPlaylistNotFound) || err == nil {
			err = k8serrors.NewNotFound(s.store.SingularQualifiedResource, name)
		}
		return nil, err
	}

	// The resource needs both
	provisioningData, err := s.builder.provisioningService.GetProvisionedDashboardDataByDashboardUID(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}
	//if provisioningData != nil {
	// TODO? shorten the path based on the full provisioning source
	// id, err := filepath.Rel(
	// 	s.provisioningService.GetDashboardProvisionerResolvedPath(provisioningData.Name),
	// 	provisioningData.ExternalID,
	// )
	//}
	return convertToK8sResource(dto, provisioningData, s.namespacer), nil
}
