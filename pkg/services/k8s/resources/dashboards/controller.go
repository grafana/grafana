package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"
)

func (s *Service) Run(ctx context.Context) error {
	dashboardInformer := s.dashboardResource

	dashboardInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			dash, err := interfaceToK8sDashboard(obj)
			if err != nil {
				s.log.Error("dashboard add failed", err)
				return
			}

			dto, err := k8sDashboardToDashboardDTO(dash)
			if err != nil {
				s.log.Error("dashboard add failed", "err", err)
			}

			if existing, err := s.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
				s.log.Error("dashboard already exists, skipping")
				return
			}

			signedInUser, err := s.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
			if err != nil {
				s.log.Error("orig.SaveDashboard failed", err)
			}

			dto.User = signedInUser

			_, err = s.dashboardService.SaveDashboard(context.Background(), dto, true)
			if err != nil {
				s.log.Error("orig.SaveDashboard failed", err)
				return
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			dash, err := interfaceToK8sDashboard(newObj)
			if err != nil {
				s.log.Error("dashboard add failed", err)
				return
			}

			dto, err := k8sDashboardToDashboardDTO(dash)
			if err != nil {
				s.log.Error("dashboard update failed", "err", err)
			}

			if existing, err := s.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID}); err == nil && existing.Version >= dto.Dashboard.Version {
				s.log.Error("dashboard version already exists, skipping")
				return
			}

			signedInUser, err := s.getSignedInUser(ctx, dto.OrgID, dto.Dashboard.UpdatedBy)
			if err != nil {
				s.log.Error("orig.SaveDashboard failed", err)
			}

			dto.User = signedInUser

			_, err = s.dashboardService.SaveDashboard(context.Background(), dto, true)
			if err != nil {
				s.log.Error("orig.SaveDashboard failed", err)
				return
			}
		},
		DeleteFunc: func(obj interface{}) {
			dash, err := interfaceToK8sDashboard(obj)
			if err != nil {
				s.log.Error("dashboard delete failed", err)
				return
			}
			dto, err := k8sDashboardToDashboardDTO(dash)
			if err != nil {
				s.log.Error("dashboard delete failed", "err", err)
			}
			existing, err := s.dashboardService.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: dto.Dashboard.UID, OrgID: dto.OrgID})
			// no dashboard found, nothing to delete
			if err != nil {
				return
			}

			if err := s.dashboardService.DeleteDashboard(ctx, existing.ID, existing.OrgID); err != nil {
				s.log.Error("orig.DeleteDashboard failed", err)
			}
			s.log.Debug("dashboard deleted")
		},
	})

	<-ctx.Done()
	return nil
}

// only run service if feature toggle is enabled
func (s *Service) IsDisabled() bool {
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagK8s)
}

// TODO: get the admin user using userID 1 and orgID 1
// is this safe? probably not.
func (s *Service) getSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
	querySignedInUser := user.GetSignedInUserQuery{UserID: 1, OrgID: 1}
	signedInUser, err := s.userService.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser)
	if err != nil {
		return nil, err
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := s.accessControlService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
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
func k8sDashboardToDashboardDTO(dash *k8ssys.Base[dashboard.Dashboard]) (*dashboards.SaveDashboardDTO, error) {
	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
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

	return &dto, nil
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

	if v, ok := a["slug"]; ok {
		dto.Dashboard.Slug = v
	}

	if v, ok := a["title"]; ok {
		dto.Dashboard.Title = v
	}

	return dto
}
