package publicdashboard

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	publicdashboardService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/user"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	log                    log.Logger
	publicDashboardService publicdashboardService.PublicDashboardServiceImpl
	userService            user.Service
	accessControlService   accesscontrol.Service
}

func ProvideWatcher() *watcher {
	return &watcher{}
}

func (w *watcher) Add(ctx context.Context, obj *PublicDashboard) error {
	w.log.Debug("adding public dashboard", "obj", obj)
	// convert to dto
	dto, err := k8sPublicDashboardToDTO(obj)
	if err != nil {
		return err
	}

	// get user
	signedInUser, err := w.getSignedInUser(ctx, dto.OrgId, dto.UserId)
	if err != nil {
		return err
	}

	// call service
	_, err = w.publicDashboardService.Create(ctx, signedInUser, dto)
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

func (w *watcher) getSignedInUser(ctx context.Context, orgID int64, userID int64) (*user.SignedInUser, error) {
	querySignedInUser := user.GetSignedInUserQuery{UserID: userID, OrgID: orgID}
	signedInUser, err := w.userService.GetSignedInUserWithCacheCtx(ctx, &querySignedInUser)
	if err != nil {
		return nil, err
	}

	if signedInUser.Permissions == nil {
		signedInUser.Permissions = make(map[int64]map[string][]string)
	}

	if signedInUser.Permissions[signedInUser.OrgID] == nil {
		permissions, err := w.accessControlService.GetUserPermissions(ctx, signedInUser, accesscontrol.Options{})
		if err != nil {
			return nil, err
		}
		signedInUser.Permissions[signedInUser.OrgID] = accesscontrol.GroupScopesByAction(permissions)
	}

	return signedInUser, nil
}

func k8sPublicDashboardToDTO(pd *PublicDashboard) (*publicdashboardModels.SavePublicDashboardDTO, error) {
	dto := &publicdashboardModels.SavePublicDashboardDTO{
		DashboardUid: pd.Spec.DashboardUid,
		PublicDashboard: &publicdashboardModels.PublicDashboard{
			Uid:          pd.Spec.Uid,
			AccessToken:  *pd.Spec.AccessToken,
			DashboardUid: pd.Spec.DashboardUid,
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

	if v, ok := a["userId"]; ok {
		dto.UserId, err = strconv.ParseInt(v, 10, 64)
		if err != nil {
			return nil, err
		}
	}

	if v, ok := a["dashboardUid"]; ok {
		dto.DashboardUid = v
	}

	if v, ok := a["timeSettings"]; ok {
		var ts *publicdashboardModels.TimeSettings
		err = ts.FromDB([]byte(v))
		if err != nil {
			return nil, err
		}
		dto.PublicDashboard.TimeSettings = ts
	}

	return dto, nil
}
