package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type MuteTimingService struct {
	config AMConfigStore
	prov   ProvisioningStore
	xact   TransactionManager
	log    log.Logger
}

func NewMuteTimingService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *MuteTimingService {
	return &MuteTimingService{
		config: config,
		prov:   prov,
		xact:   xact,
		log:    log,
	}
}

func (m *MuteTimingService) GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTiming, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := m.config.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return nil, err
	}

	if q.Result == nil {
		return nil, fmt.Errorf("no alertmanager configuration present in this org")
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	result := make([]definitions.MuteTiming, 0, len(cfg.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range cfg.AlertmanagerConfig.MuteTimeIntervals {
		result = append(result, definitions.MuteTiming{MuteTimeInterval: interval})
	}
	return result, nil
}
