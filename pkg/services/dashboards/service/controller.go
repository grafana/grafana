package service

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/bridge"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

type DashboardController struct {
	cfg                  *setting.Cfg
	dashboardService     *DashboardServiceImpl
	bridgeService        *bridge.Service
	reg                  *corecrd.Registry
	userService          user.Service
	accessControlService accesscontrol.Service
}

func ProvideDashboardController(cfg *setting.Cfg, bridgeService *bridge.Service, reg *corecrd.Registry, dasboardService *DashboardServiceImpl, userService user.Service, accessControl accesscontrol.Service) *DashboardController {
	return &DashboardController{
		cfg:                  cfg,
		dashboardService:     dasboardService,
		bridgeService:        bridgeService,
		reg:                  reg,
		userService:          userService,
		accessControlService: accessControl,
	}
}

func (c *DashboardController) Run(ctx context.Context) error {
	dashboardCRD := c.reg.Dashboard()

	gvr := schema.GroupVersionResource{
		Group:    dashboardCRD.GVK().Group,
		Version:  dashboardCRD.GVK().Version,
		Resource: dashboardCRD.Schema.Spec.Names.Plural,
	}

	factory := dynamicinformer.NewDynamicSharedInformerFactory(c.bridgeService.ClientSet.Dynamic, time.Minute)
	dashboardInformer := factory.ForResource(gvr).Informer()

	dashboardInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			dash, err := interfaceToK8sDashboard(obj)
			if err != nil {
				fmt.Println("dashboard add failed", err)
				return
			}

			dto := k8sDashboardToDashboardDTO(dash)
			if existing, err := c.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
				fmt.Println("dashboard already exists, skipping")
				return
			}

			signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
			if err != nil {
				fmt.Println("dashboardService.SaveDashboard failed", err)
			}

			dto.User = signedInUser

			_, err = c.dashboardService.SaveDashboard(context.Background(), dto, true)
			if err != nil {
				fmt.Println("dashboardService.SaveDashboard failed", err)
				return
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			dash, err := interfaceToK8sDashboard(newObj)
			if err != nil {
				fmt.Println("dashboard add failed", err)
				return
			}

			dto := k8sDashboardToDashboardDTO(dash)
			if existing, err := c.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
				fmt.Println("dashboard version already exists, skipping")
				return
			}

			signedInUser, err := c.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
			if err != nil {
				fmt.Println("dashboardService.SaveDashboard failed", err)
			}

			dto.User = signedInUser

			_, err = c.dashboardService.SaveDashboard(context.Background(), dto, true)
			if err != nil {
				fmt.Println("dashboardService.SaveDashboard failed", err)
				return
			}
		},
		DeleteFunc: func(obj interface{}) {
			dash, err := interfaceToK8sDashboard(obj)
			if err != nil {
				fmt.Println("dashboard delete failed", err)
				return
			}
			dto := k8sDashboardToDashboardDTO(dash)
			existing, err := c.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID})
			// no dashboard found, nothing to delete
			if err != nil {
				return
			}

			if err := c.dashboardService.DeleteDashboard(ctx, existing.ID, existing.OrgID); err != nil {
				fmt.Println("dashboardService.DeleteDashboard failed", err)
			}
			fmt.Println("dashboard deleted")
		},
	})

	stop := make(chan struct{})
	defer close(stop)

	factory.Start(stop)
	<-ctx.Done()
	return nil
}

// only run service if feature toggle is enabled
func (c *DashboardController) IsDisabled() bool {
	return !c.cfg.IsFeatureToggleEnabled(featuremgmt.FlagApiserver)
}

// TODO: get the admin user using userID 1 and orgID 1
// is this safe? probably not.
func (c *DashboardController) getSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
	querySignedInUser := user.GetSignedInUserQuery{UserID: 1, OrgID: 1}
	signedInUser, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser)
	if err != nil {
		return nil, err
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := c.accessControlService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
		if err != nil {
			return nil, err
		}
		signedInUser.Permissions[signedInUser.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	return signedInUser, nil
}

// TODO: this is a hack to convert the k8s dashboard to a DTO
func interfaceToK8sDashboard(obj interface{}) (*k8ssys.Base[dashboard.Dashboard], error) {
	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("failed to convert interface{} to *unstructured.Unstructured")
	}

	dash := k8ssys.Base[dashboard.Dashboard]{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(uObj.UnstructuredContent(), &dash)
	if err != nil {
		return nil, fmt.Errorf("failed to convert *unstructured.Unstructured to *k8ssys.Base[dashboard.Dashboard]")
	}
	return &dash, nil
}

// TODO: this is a hack to convert the k8s dashboard to a DTO
// unclear if any of the fields are missing at this point.
func k8sDashboardToDashboardDTO(dash *k8ssys.Base[dashboard.Dashboard]) *dashboards.SaveDashboardDTO {
	data := simplejson.NewFromAny(dash.Spec)
	dto := dashboards.SaveDashboardDTO{
		Dashboard: &dashboards.Dashboard{
			FolderID: 0,
			IsFolder: false,
			Data:     data,
		},
	}
	if dash.Spec.Id != nil {
		dto.Dashboard.ID = *dash.Spec.Id
	}
	if dash.Spec.Uid != nil {
		dto.Dashboard.UID = *dash.Spec.Uid
	}
	if dash.Spec.Title != nil {
		dto.Dashboard.Title = *dash.Spec.Title
	}
	if dash.Spec.Version != nil {
		dto.Dashboard.Version = *dash.Spec.Version
	}
	if dash.Spec.GnetId != nil {
		gnetId, err := strconv.ParseInt(*dash.Spec.GnetId, 10, 64)
		if err == nil {
			dto.Dashboard.GnetID = gnetId
		}
	}

	dto = parseAnnotations(dash, dto)
	dto = parseLabels(dash, dto)

	fmt.Printf("controller dashboard %+v \n", dto.Dashboard)

	return &dto
}

// parse k8s annotations into DTO fields
func parseAnnotations(dash *k8ssys.Base[dashboard.Dashboard], dto dashboards.SaveDashboardDTO) dashboards.SaveDashboardDTO {
	if dash.ObjectMeta.Annotations == nil {
		return dto
	}
	a := dash.ObjectMeta.Annotations
	if v, ok := a["message"]; ok {
		dto.Message = v
	}

	if v, ok := a["orgID"]; ok {
		orgID, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.OrgID = orgID
		}
	}

	if v, ok := a["overwrite"]; ok {
		overwrite, err := strconv.ParseBool(v)
		if err == nil {
			dto.Overwrite = overwrite
		}
	}

	if v, ok := a["updatedBy"]; ok {
		updatedBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.UpdatedBy = updatedBy
		}
	}

	if v, ok := a["updatedAt"]; ok {
		updatedAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Updated = time.Unix(0, updatedAt)
			dto.UpdatedAt = time.Unix(0, updatedAt)
		}
	}

	if v, ok := a["createdBy"]; ok {
		createdBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.CreatedBy = createdBy
		}
	}

	if v, ok := a["createdAt"]; ok {
		createdAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Created = time.Unix(0, createdAt)
		}
	}

	if v, ok := a["folderID"]; ok {
		folderId, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.FolderID = folderId
		}
	}

	if v, ok := a["isFolder"]; ok {
		isFolder, err := strconv.ParseBool(v)
		if err == nil {
			dto.Dashboard.IsFolder = isFolder
		}
	}

	if v, ok := a["pluginID"]; ok {
		dto.Dashboard.PluginID = v
	}

	if v, ok := a["version"]; ok {
		version, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Version = int(version)
		}
	}

	if v, ok := a["hasACL"]; ok {
		hasACL, err := strconv.ParseBool(v)
		if err == nil {
			dto.Dashboard.HasACL = hasACL
		}
	}

	return dto
}

// parse k8s labels into DTO fields
func parseLabels(dash *k8ssys.Base[dashboard.Dashboard], dto dashboards.SaveDashboardDTO) dashboards.SaveDashboardDTO {
	if dash.ObjectMeta.Labels == nil {
		return dto
	}
	l := dash.ObjectMeta.Labels

	if v, ok := l["slug"]; ok {
		dto.Dashboard.Slug = v
	}
	if v, ok := l["title"]; ok {
		dto.Dashboard.Title = v
	}

	return dto
}
