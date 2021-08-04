package notifier

import (
	"context"
	"fmt"
	"sync"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/infra/log"
)

type Alertmanager struct {
	Instances   map[int64]*alertmanager
	instanceMtx sync.RWMutex
	ctx         context.Context
	cfg         *setting.Cfg
	logger      log.Logger
	metrics     *metrics.Metrics
	store       store.AlertingStore
	children    *errgroup.Group
}

func (am *Alertmanager) SaveAndApplyConfig(orgID int64, config *apimodels.PostableUserConfig) error {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return fmt.Errorf("unable to retrieve alertmanager")
	}
	return amInstance.SaveAndApplyConfig(orgID, config)
}

func (am *Alertmanager) SaveAndApplyDefaultConfig(orgID int64) error {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return fmt.Errorf("unable to retrieve alertmanager")
	}
	return amInstance.SaveAndApplyDefaultConfig(orgID)
}

func (am *Alertmanager) GetStatus(orgID int64) apimodels.GettableStatus {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return apimodels.GettableStatus{}
	}
	return amInstance.GetStatus()
}

func (am *Alertmanager) CreateSilence(orgID int64, ps *apimodels.PostableSilence) (string, error) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return "", fmt.Errorf("unable to retrieve alertmanager for CreateSilence")
	}
	return amInstance.CreateSilence(ps)
}

func (am *Alertmanager) DeleteSilence(orgID int64, silenceID string) error {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
	}
	return amInstance.DeleteSilence(silenceID)
}

func (am *Alertmanager) GetSilence(orgID int64, silenceID string) (apimodels.GettableSilence, error) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return apimodels.GettableSilence{}, fmt.Errorf("unable to retrieve alertmanager")
	}
	return amInstance.GetSilence(silenceID)
}

func (am *Alertmanager) ListSilences(orgID int64, filter []string) (apimodels.GettableSilences, error) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return nil, fmt.Errorf("unable to retrieve alertmanager")
	}
	return amInstance.ListSilences(filter)
}

func (am *Alertmanager) GetAlertGroups(orgID int64, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Error("unable to retrieve alertmanager", "orgID", orgID)
		return nil, fmt.Errorf("unable to retrieve alertmanager")
	}
	return amInstance.GetAlertGroups(active, silenced, inhibited, filter, receiver)
}

func (am *Alertmanager) PutAlerts(orgID int64, alerts apimodels.PostableAlerts) error {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		return fmt.Errorf("unable to get alertmanager for orgID: %d", orgID)
	}
	return amInstance.PutAlerts(alerts)
}

func (am *Alertmanager) GetAM(orgID int64) (*alertmanager, error) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	amInstance, ok := am.Instances[orgID]
	if !ok {
		return nil, fmt.Errorf("unable to get alertmanager for orgID: %d", orgID)
	}
	return amInstance, nil
}

func New(cfg *setting.Cfg, store store.AlertingStore, m *metrics.Metrics) *Alertmanager {
	return &Alertmanager{
		Instances:   make(map[int64]*alertmanager),
		cfg:         cfg,
		instanceMtx: sync.RWMutex{},
		logger:      log.New("Alertmanager"),
		metrics:     m,
		store:       store,
	}
}

func (am *Alertmanager) Ready(orgID int64) bool {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	instance, ok := am.Instances[orgID]
	if !ok {
		am.logger.Debug("ready check for alertmanager instance that was not found", "orgID", orgID)
		return false
	}
	return instance.Ready()
}

func (am *Alertmanager) Run(ctx context.Context) error {
	am.children, am.ctx = errgroup.WithContext(ctx)
	return am.children.Wait()
}

func (am *Alertmanager) UpdateInstances(orgIDs ...int64) {
	found := make(map[int64]struct{})
	for _, orgID := range orgIDs {
		found[orgID] = struct{}{}
		_, ok := am.getInstance(orgID)
		if !ok {
			// new org
			am.logger.Debug("starting Alertmanager instance", "org", orgID)
			if err := am.addInstance(orgID); err != nil {
				am.logger.Error("failed to start Alertmanager instance", "org", orgID, "error", err)
			}
		}
	}

	for item := range am.iterInstances() {
		_, ok := found[item.orgID]
		if !ok {
			am.logger.Debug("stopping Alertmanager instance", "org", item.orgID)
			if err := item.instance.StopAndWait(); err != nil {
				am.logger.Error("failed to stop Alertmanager instance", "org", item.orgID, "error", err)
			}
			am.deleteInstance(item.orgID)
		}
	}
}

func (am *Alertmanager) getInstance(orgID int64) (*alertmanager, bool) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	instance, ok := am.Instances[orgID]
	return instance, ok
}

func (am *Alertmanager) deleteInstance(orgID int64) {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	delete(am.Instances, orgID)
}

func (am *Alertmanager) addInstance(orgID int64) error {
	am.instanceMtx.RLock()
	defer am.instanceMtx.RUnlock()
	newAM, err := new(am.cfg, am.store, am.metrics, orgID)
	if err != nil {
		return err
	}
	am.Instances[orgID] = newAM

	am.children.Go(func() error {
		err := newAM.Run(am.ctx)
		if err != nil {
			am.logger.Error("unable to start alertmanager", "error", err.Error(), "orgID", orgID)
		}
		return err
	})
	return nil
}

type item struct {
	orgID    int64
	instance *alertmanager
}

func (am *Alertmanager) iterInstances() <-chan item {
	c := make(chan item)
	f := func() {
		am.instanceMtx.RLock()
		defer am.instanceMtx.RUnlock()

		for k, v := range am.Instances {
			c <- item{
				orgID:    k,
				instance: v,
			}
		}
		close(c)
	}
	go f()

	return c
}
