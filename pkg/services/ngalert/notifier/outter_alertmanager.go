package notifier

import (
	"context"
	"fmt"
	"sync"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana/pkg/infra/log"
)

type Alertmanager struct {
	Instances   map[int64]*alertmanager
	instanceMtx sync.RWMutex
	logger      log.Logger
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

func New(cfg *setting.Cfg, store store.AlertingStore, m *metrics.Metrics) (*Alertmanager, error) {
	//TODO: remove this because it's a hack until we have the org id column for alert_configuration
	orgIDs := []int64{1, 2, 3}
	am := &Alertmanager{
		Instances:   make(map[int64]*alertmanager, len(orgIDs)),
		instanceMtx: sync.RWMutex{},
		logger:      log.New("Alertmanager"),
	}
	for _, id := range orgIDs {
		newAM, err := new(cfg, store, m)
		if err != nil {
			//TODO: log this
			continue
		}
		am.Instances[id] = newAM
	}
	return am, nil
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
	for orgID, amInstance := range am.Instances {
		amInstance := amInstance
		orgID := orgID
		go func() {
			err := amInstance.Run(ctx)
			if err != nil {
				am.logger.Error("unable to start alertmanager", "error", err.Error(), "orgID", orgID)
			}
		}()
	}
	return nil
}
