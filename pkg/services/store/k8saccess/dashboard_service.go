package k8saccess

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/bridge"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
)

type k8sDashboardService struct {
	orig      dashboards.DashboardService
	clientSet *bridge.Clientset
	store     entity.EntityStoreServer
}

var _ dashboards.DashboardService = (*k8sDashboardService)(nil)

func NewDashboardService(cfg *setting.Cfg, orig dashboards.DashboardService, store entity.EntityStoreServer) dashboards.DashboardService {
	config, err := bridge.LoadRestConfig(cfg)
	if err != nil {
		panic(err)
	}
	clientSet, err := bridge.NewClientset(config)
	if err != nil {
		panic(err)
	}
	return &k8sDashboardService{
		orig:      orig,
		clientSet: clientSet,
		store:     store,
	}
}

func (s *k8sDashboardService) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*dashboards.SaveDashboardCommand, error) {
	return s.orig.BuildSaveDashboardCommand(ctx, dto, shouldValidateAlerts, validateProvisionedDashboard)
}

func (s *k8sDashboardService) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return s.orig.DeleteDashboard(ctx, dashboardId, orgId)
}

func (s *k8sDashboardService) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	return s.orig.FindDashboards(ctx, query)
}

func (s *k8sDashboardService) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return s.orig.GetDashboard(ctx, query)
}

func (s *k8sDashboardService) GetDashboardACLInfoList(ctx context.Context, query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	return s.orig.GetDashboardACLInfoList(ctx, query)
}

func (s *k8sDashboardService) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	return s.orig.GetDashboards(ctx, query)
}

func (s *k8sDashboardService) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	return s.orig.GetDashboardTags(ctx, query)
}

func (s *k8sDashboardService) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	return s.orig.GetDashboardUIDByID(ctx, query)
}

func (s *k8sDashboardService) HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *folder.HasAdminPermissionInDashboardsOrFoldersQuery) (bool, error) {
	return s.orig.HasAdminPermissionInDashboardsOrFolders(ctx, query)
}

func (s *k8sDashboardService) HasEditPermissionInFolders(ctx context.Context, query *folder.HasEditPermissionInFoldersQuery) (bool, error) {
	return s.orig.HasEditPermissionInFolders(ctx, query)
}

func (s *k8sDashboardService) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
	return s.orig.ImportDashboard(ctx, dto)
}

func (s *k8sDashboardService) MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error {
	return s.orig.MakeUserAdmin(ctx, orgID, userID, dashboardID, setViewAndEditPermissions)
}

// example write from app sdk https://github.com/grafana/grafana-app-sdk/blob/44004e08c6cb131e3a2b8fed63f85ccc2ecc9220/crd/simplestore.go#L95
// questions:
// - how do we get a namespace?
// - how do we use the dashboard core kind?
// - how do we translate incoming dashboard DTO to dashboard kind?
func (s *k8sDashboardService) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO, allowUiUpdate bool) (*dashboards.Dashboard, error) {
	//s.clientSet.RESTClient().Patch(types.ApplyPatchType).Resource().
	//fmt.Printf("SAVE: " + dto.Dashboard.UID)
	//if labels == nil {
	//	labels = make(map[string]string)
	//}
	//o := Base[T]{
	//	TypeMeta: metav1.TypeMeta{
	//		Kind:       s.cr.kind,
	//		APIVersion: s.cr.GroupVersion().Identifier(),
	//	},
	//	ObjectMeta: metav1.ObjectMeta{
	//		Name:   name,
	//		Labels: labels,
	//	},
	//	Spec: obj,
	//}
	//b, err := json.Marshal(o)
	//if err != nil {
	//	return nil, err
	//}
	//status := 0
	//into := Base[T]{}
	//err = s.client.Post().Resource(s.cr.Plural()).Namespace(namespace).Body(b).Do(ctx).StatusCode(&status).Into(&into)
	//if err != nil {
	//	return nil, newKubernetesClientError(err, status)
	//}
	//return &into, nil
	return s.orig.SaveDashboard(ctx, dto, allowUiUpdate)
}

func (s *k8sDashboardService) SearchDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) error {
	return s.orig.SearchDashboards(ctx, query)
}

func (s *k8sDashboardService) UpdateDashboardACL(ctx context.Context, uid int64, items []*dashboards.DashboardACL) error {
	return s.orig.UpdateDashboardACL(ctx, uid, items)
}

func (s *k8sDashboardService) DeleteACLByUser(ctx context.Context, userID int64) error {
	return s.orig.DeleteACLByUser(ctx, userID)
}

func (s *k8sDashboardService) CountDashboardsInFolder(ctx context.Context, query *dashboards.CountDashboardsInFolderQuery) (int64, error) {
	return s.orig.CountDashboardsInFolder(ctx, query)
}
