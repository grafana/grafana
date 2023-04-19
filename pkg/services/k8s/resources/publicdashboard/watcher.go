package publicdashboard

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	publicdashboardStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
	"gomodules.xyz/jsonpatch/v2"
)

var _ Watcher = (*watcher)(nil)

type watcher struct {
	log                  log.Logger
	publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl
	userService          user.Service
	accessControlService accesscontrol.Service
}

func ProvideWatcher(userService user.Service,
	publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl,
	accessControlService accesscontrol.Service) Watcher {
	return &watcher{
		log:                  log.New("k8s.publicdashboard.service-watcher"),
		publicDashboardStore: publicDashboardStore,
		userService:          userService,
		accessControlService: accessControlService,
	}
}

func (w *watcher) Add(ctx context.Context, obj *PublicDashboard) error {
	//convert to dto
	pdModel, err := k8sObjectToModel(obj)
	if err != nil {
		return err
	}

	// convert to cmd
	cmd := publicdashboardModels.SavePublicDashboardCommand{
		PublicDashboard: *pdModel,
	}

	// call service
	_, err = w.publicDashboardStore.Create(ctx, cmd)
	if err != nil {
		return err
	}

	return nil
}

func (w *watcher) Update(ctx context.Context, oldObj, newObj *PublicDashboard) error {

	//convert to publicdashboard model
	newPd, err := k8sObjectToModel(newObj)
	if err != nil {
		return err
	}
	newBytes, err := json.Marshal(newPd)
	if err != nil {
		return err
	}

	// get existing object from db
	existingPd, err := w.publicDashboardStore.Find(ctx, newPd.Uid)
	if err != nil {
		return err
	}
	existingBytes, err := json.Marshal(existingPd)
	if err != nil {
		return err
	}

	// create patch diff
	ops, err := jsonpatch.CreatePatch(existingBytes, newBytes)
	if err != nil {
		return nil
	}

	// no ops, return
	if len(ops) == 0 {
		return nil
	}

	// convert to cmd
	cmd := publicdashboardModels.SavePublicDashboardCommand{
		PublicDashboard: *newPd,
	}

	// call service
	_, err = w.publicDashboardStore.Update(ctx, cmd)
	if err != nil {
		return err
	}

	// log whether enabled has changed
	if newPd.IsEnabled != existingPd.IsEnabled {
		w.log.Info("Public dashboard changed", "publicDashboardUid", newPd.Uid, "dashboardUid", newPd.DashboardUid, "user", newPd.UpdatedBy, "enabled", newPd.IsEnabled)
	}

	return nil
}

func (w *watcher) Delete(ctx context.Context, obj *PublicDashboard) error {
	existing, err := w.publicDashboardStore.Find(ctx, obj.Spec.Uid)
	if err != nil {
		return err
	}

	// no public dashboard
	if existing == nil {
		return nil
	}

	_, err = w.publicDashboardStore.Delete(ctx, existing.Uid)
	return err
}
