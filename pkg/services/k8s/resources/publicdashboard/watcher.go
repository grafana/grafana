package publicdashboard

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	publicdashboardStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	log                  log.Logger
	webhooks             *WebhooksAPI
	publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl
	userService          user.Service
	accessControlService accesscontrol.Service
}

func ProvideWatcher(userService user.Service, webhooks *WebhooksAPI, publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl, accessControlService accesscontrol.Service) *watcher {
	return &watcher{
		log:                  log.New("k8s.publicdashboard.service-watcher"),
		webhooks:             webhooks,
		publicDashboardStore: publicDashboardStore,
		userService:          userService,
		accessControlService: accessControlService,
	}
}

func (w *watcher) Add(ctx context.Context, obj *PublicDashboard) error {
	//convert to dto
	dto, err := k8sPublicDashboardToDTO(obj)
	if err != nil {
		return err
	}

	w.log.Debug("adding public dashboard", "obj", obj)

	// convert to cmd
	cmd := publicdashboardModels.SavePublicDashboardCommand{
		PublicDashboard: *dto.PublicDashboard,
	}

	// call service
	_, err = w.publicDashboardStore.Create(ctx, cmd)
	if err != nil {
		return err
	}

	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *PublicDashboard) error {
	// TODO
	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *PublicDashboard) error {
	// TODO
	return nil
}

func k8sPublicDashboardToDTO(pd *PublicDashboard) (*publicdashboardModels.SavePublicDashboardDTO, error) {
	// make sure we have an accessToken
	if pd.Spec.AccessToken == nil {
		at := ""
		pd.Spec.AccessToken = &at
	}

	dto := &publicdashboardModels.SavePublicDashboardDTO{
		DashboardUid: pd.Spec.DashboardUid,
		PublicDashboard: &publicdashboardModels.PublicDashboard{
			Uid:                  pd.Spec.Uid,
			AccessToken:          *pd.Spec.AccessToken,
			DashboardUid:         pd.Spec.DashboardUid,
			AnnotationsEnabled:   pd.Spec.AnnotationsEnabled,
			TimeSelectionEnabled: pd.Spec.TimeSelectionEnabled,
			IsEnabled:            pd.Spec.IsEnabled,
		},
	}

	// parse fields from annotations
	dto, err := parseAnnotations(pd, dto)
	if err != nil {
		return nil, err
	}

	return dto, nil
}

func parseAnnotations(pd *PublicDashboard, dto *publicdashboardModels.SavePublicDashboardDTO) (*publicdashboardModels.SavePublicDashboardDTO, error) {
	var err error

	if pd.ObjectMeta.Annotations == nil {
		return dto, nil
	}

	a := pd.ObjectMeta.Annotations

	if v, ok := a["orgID"]; ok {
		dto.OrgId, err = strconv.ParseInt(v, 10, 64)
		if err != nil {
			return nil, err
		}
	}

	if v, ok := a["dashboardUid"]; ok {
		dto.DashboardUid = v
	}

	if v, ok := a["updatedBy"]; ok {
		updatedBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.PublicDashboard.UpdatedBy = updatedBy
		}
	}

	if v, ok := a["updatedAt"]; ok {
		updatedAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.PublicDashboard.UpdatedAt = time.Unix(0, updatedAt)
		}
	}

	if v, ok := a["createdBy"]; ok {
		createdBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.PublicDashboard.CreatedBy = createdBy
		}
	}

	if v, ok := a["createdAt"]; ok {
		createdAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.PublicDashboard.CreatedAt = time.Unix(0, createdAt)
		}
	}

	if v, ok := a["timeSettings"]; ok {
		ts := &publicdashboardModels.TimeSettings{}
		err = ts.FromDB([]byte(v))
		if err != nil {
			return nil, err
		}
		dto.PublicDashboard.TimeSettings = ts
	}

	return dto, nil
}
