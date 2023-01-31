package k8saccess

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/bridge"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

type k8sDashboardService struct {
	orig      dashboards.DashboardService
	clientSet *bridge.Clientset
	reg       *corecrd.Registry
	store     entity.EntityStoreServer
	Kinds     *corekind.Base
}

var _ dashboards.DashboardService = (*k8sDashboardService)(nil)

func NewDashboardService(orig dashboards.DashboardService, store entity.EntityStoreServer, reg *corecrd.Registry, troll *bridge.Service, kinds *corekind.Base) dashboards.DashboardService {
	return &k8sDashboardService{
		reg:       reg,
		orig:      orig,
		clientSet: troll.ClientSet,
		store:     store,
		Kinds:     kinds,
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
// - how do we use the dashboard core kind?
// - how do we translate incoming dashboard DTO to dashboard kind?
func (s *k8sDashboardService) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO, allowUiUpdate bool) (*dashboards.Dashboard, error) {
	namespace := "default"
	//restClient := s.clientSet.Clientset.RESTClient()

	uid := dto.Dashboard.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	uid = strings.ToLower(uid) // !!!!!!

	//labels := make(map[string]string)
	//annotations := make(map[string]string)

	// take the kindsys dashboard kind and alias it so it's easier to distinguish from dashboards.Dashboard
	type dashboardKind = dashboard.Dashboard
	// get the dashboard CRD from the CRD registry
	dashboardCRD := s.reg.Dashboard()

	if dto.Dashboard.Data == nil {
		return nil, fmt.Errorf("POTATO: DASHBOARD DATA NIL")
	}

	// HACK, remove empty ID!!
	dto.Dashboard.Data.Del("id")
	dto.Dashboard.Data.Set("uid", uid)
	// strip nulls...
	stripNulls(dto.Dashboard.Data)

	//dashbytes, err := json.Marshal(dto.Dashboard)
	dashbytes, err := dto.Dashboard.Data.MarshalJSON()
	if err != nil {
		return nil, err
	}

	fmt.Printf("%s", string(dashbytes))

	d, _, err := s.Kinds.Dashboard().JSONValueMux(dashbytes)
	if err != nil {
		// return nil, err
		fmt.Printf("ERRRO: %s", err)
	}
	if d.Uid == nil {
		d.Uid = &uid
	}
	if d.Title == nil {
		d.Title = &dto.Dashboard.Title
	}

	fmt.Printf("Dashboard title: %s", *d.Title)

	b := k8ssys.Base[dashboardKind]{
		TypeMeta: metav1.TypeMeta{
			Kind:       dashboardCRD.GVK().Kind,
			APIVersion: dashboardCRD.GVK().Group + "/" + dashboardCRD.GVK().Version,
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      uid,
		},
		Spec: *d,
	}

	gk := schema.GroupKind{
		Group: dashboardCRD.GVK().Group,
		Kind:  dashboardCRD.GVK().Kind,
	}

	resource, err := s.clientSet.GetResource(gk, namespace, dashboardCRD.GVK().Version)
	if err != nil {
		return nil, err
	}

	o, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&b)
	if err != nil {
		return nil, err
	}

	uObj := &unstructured.Unstructured{
		Object: o,
	}

	out, err := resource.Create(ctx, uObj, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	jj, err := json.MarshalIndent(out, "", " ")
	fmt.Printf("GOT: %v", string(jj))

	return dto.Dashboard, err
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

func stripNulls(j *simplejson.Json) {
	m, err := j.Map()
	if err != nil {
		arr, err := j.Array()
		if err == nil {
			for i := range arr {
				stripNulls(j.GetIndex(i))
			}
		}
		return
	}
	for k, v := range m {
		if v == nil {
			j.Del(k)
		} else {
			stripNulls(j.Get(k))
		}
	}
}
