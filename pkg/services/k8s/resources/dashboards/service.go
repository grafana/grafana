package dashboards

import (
	"context"
	"fmt"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// NOTE this is how you reset the CRD
//kubectl --kubeconfig=devenv/docker/blocks/apiserver/apiserver.kubeconfig delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type Service struct {
	cfg *setting.Cfg
	log log.Logger

	dashboardClient dynamic.ResourceInterface

	reg   *corecrd.Registry
	kinds *corekind.Base

	dashboardService     dashboards.DashboardService
	userService          user.Service
	accessControlService accesscontrol.Service
}

var _ dashboards.DashboardService = (*Service)(nil)

func NewDashboardService(
	cfg *setting.Cfg,
	dashboardClient dynamic.ResourceInterface,
	reg *corecrd.Registry,
	kinds *corekind.Base,
	dashboardService dashboards.DashboardService,
	userService user.Service,
	accessControlService accesscontrol.Service,
) dashboards.DashboardService {
	return &Service{
		cfg: cfg,
		log: log.New("store.k8saccess.dashboard"),

		dashboardClient: dashboardClient,

		reg:   reg,
		kinds: kinds,

		dashboardService:     dashboardService,
		userService:          userService,
		accessControlService: accessControlService,
	}
}

func (s *Service) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO, shouldValidateAlerts bool, validateProvisionedDashboard bool) (*dashboards.SaveDashboardCommand, error) {
	return s.dashboardService.BuildSaveDashboardCommand(ctx, dto, shouldValidateAlerts, validateProvisionedDashboard)
}

func (s *Service) DeleteDashboard(ctx context.Context, dashboardId int64, orgId int64) error {
	return s.dashboardService.DeleteDashboard(ctx, dashboardId, orgId)
}

func (s *Service) FindDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	return s.dashboardService.FindDashboards(ctx, query)
}

func (s *Service) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	return s.dashboardService.GetDashboard(ctx, query)
}

func (s *Service) GetDashboardACLInfoList(ctx context.Context, query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	return s.dashboardService.GetDashboardACLInfoList(ctx, query)
}

func (s *Service) GetDashboards(ctx context.Context, query *dashboards.GetDashboardsQuery) ([]*dashboards.Dashboard, error) {
	return s.dashboardService.GetDashboards(ctx, query)
}

func (s *Service) GetDashboardTags(ctx context.Context, query *dashboards.GetDashboardTagsQuery) ([]*dashboards.DashboardTagCloudItem, error) {
	return s.dashboardService.GetDashboardTags(ctx, query)
}

func (s *Service) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	return s.dashboardService.GetDashboardUIDByID(ctx, query)
}

func (s *Service) HasAdminPermissionInDashboardsOrFolders(ctx context.Context, query *folder.HasAdminPermissionInDashboardsOrFoldersQuery) (bool, error) {
	return s.dashboardService.HasAdminPermissionInDashboardsOrFolders(ctx, query)
}

func (s *Service) HasEditPermissionInFolders(ctx context.Context, query *folder.HasEditPermissionInFoldersQuery) (bool, error) {
	return s.dashboardService.HasEditPermissionInFolders(ctx, query)
}

func (s *Service) ImportDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.Dashboard, error) {
	return s.dashboardService.ImportDashboard(ctx, dto)
}

func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, dashboardID int64, setViewAndEditPermissions bool) error {
	return s.dashboardService.MakeUserAdmin(ctx, orgID, userID, dashboardID, setViewAndEditPermissions)
}

// SaveDashboard saves the dashboard to kubernetes
func (s *Service) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO, allowUiUpdate bool) (*dashboards.Dashboard, error) {
	// config and client setup
	namespace := "default"
	// take the kindsys dashboard kind and alias it so it's easier to distinguish from dashboards.Dashboard
	type dashboardKind = dashboard.Dashboard
	// get the dashboard CRD from the CRD registry
	dashboardCRD := s.reg.Dashboard()
	gk := schema.GroupKind{
		Group: dashboardCRD.GVK().Group,
		Kind:  dashboardCRD.GVK().Kind,
	}

	// get's client to operate on resource (dashboard)
	resourceClient, err := s.clientSet.GetResource(gk, namespace, dashboardCRD.GVK().Version)
	if err != nil {
		return nil, fmt.Errorf("resource client missing: %w", err)
	}

	/////////////////
	// do  work

	updateDashboard := false
	resourceVersion := ""

	// FIXME this is not reliable and is spaghetti. Change UID or create mapping
	// for k8s with uuidV4
	uid := dto.Dashboard.UID
	if uid == "" {
		uid, err = getUnusedGrafanaUID(ctx, resourceClient)
		if err != nil {
			return nil, err
		}
	} else {
		// check if dashboard exists in k8s. if it does, we're gonna do an update, if
		rv, ok, err := getResourceVersion(ctx, resourceClient, uid)
		if !ok {
			return nil, err
		}

		if rv != "" {
			// exists in k8s
			updateDashboard = true
			resourceVersion = rv
		}
	}

	if dto.Dashboard.Data == nil {
		return nil, fmt.Errorf("dashboard data is nil")
	}

	// HACK, remove empty ID!!
	dto.Dashboard.Data.Del("id")
	dto.Dashboard.Data.Set("uid", uid)
	dto.Dashboard.UID = uid
	// strip nulls...
	stripNulls(dto.Dashboard.Data)

	dashbytes, err := dto.Dashboard.Data.MarshalJSON()
	if err != nil {
		return nil, err
	}

	d, _, err := s.kinds.Dashboard().JSONValueMux(dashbytes)
	if err != nil {
		return nil, fmt.Errorf("dashboard JSONValueMux failed: %w", err)
	}

	if d.Uid == nil {
		d.Uid = &uid
	}

	if d.Title == nil {
		d.Title = &dto.Dashboard.Title
	}

	b := k8ssys.Base[dashboardKind]{
		TypeMeta: metav1.TypeMeta{
			Kind:       dashboardCRD.GVK().Kind,
			APIVersion: dashboardCRD.GVK().Group + "/" + dashboardCRD.GVK().Version,
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   namespace,
			Name:        GrafanaUIDToK8sName(uid),
			Annotations: annotationsFromDashboardDTO(dto),
		},
		Spec: *d,
	}

	if resourceVersion != "" {
		b.ObjectMeta.ResourceVersion = resourceVersion
	}

	o, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&b)
	if err != nil {
		return nil, err
	}

	uObj := &unstructured.Unstructured{
		Object: o,
	}

	if updateDashboard {
		s.log.Debug("k8s action: update")
		_, err = resourceClient.Update(ctx, uObj, metav1.UpdateOptions{})
	} else {
		s.log.Debug("k8s action: create")
		_, err = resourceClient.Create(ctx, uObj, metav1.CreateOptions{})
	}

	// create or update error
	if err != nil {
		return nil, err
	}

	if err != nil {
		return nil, err
	}

	return dto.Dashboard, err
}

func (s *Service) SearchDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) error {
	return s.dashboardService.SearchDashboards(ctx, query)
}

func (s *Service) UpdateDashboardACL(ctx context.Context, uid int64, items []*dashboards.DashboardACL) error {
	return s.dashboardService.UpdateDashboardACL(ctx, uid, items)
}

func (s *Service) DeleteACLByUser(ctx context.Context, userID int64) error {
	return s.dashboardService.DeleteACLByUser(ctx, userID)
}

func (s *Service) CountDashboardsInFolder(ctx context.Context, query *dashboards.CountDashboardsInFolderQuery) (int64, error) {
	return s.dashboardService.CountDashboardsInFolder(ctx, query)
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

func annotationsFromDashboardDTO(dto *dashboards.SaveDashboardDTO) map[string]string {
	annotations := map[string]string{
		"version":   strconv.FormatInt(int64(dto.Dashboard.Version), 10),
		"message":   dto.Message,
		"orgID":     strconv.FormatInt(dto.OrgID, 10),
		"overwrite": strconv.FormatBool(dto.Overwrite),
		"updatedBy": strconv.FormatInt(dto.Dashboard.UpdatedBy, 10),
		"updatedAt": strconv.FormatInt(dto.Dashboard.Updated.UnixNano(), 10),
		"createdBy": strconv.FormatInt(dto.Dashboard.CreatedBy, 10),
		"createdAt": strconv.FormatInt(dto.Dashboard.Created.UnixNano(), 10),
		"folderID":  strconv.FormatInt(dto.Dashboard.FolderID, 10),
		"isFolder":  strconv.FormatBool(dto.Dashboard.IsFolder),
		"hasACL":    strconv.FormatBool(dto.Dashboard.HasACL),
		"slug":      dto.Dashboard.Slug,
		"title":     dto.Dashboard.Title,
	}

	return annotations
}
