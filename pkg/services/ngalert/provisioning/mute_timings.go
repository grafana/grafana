package provisioning

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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
	rev, err := getLastConfiguration(ctx, orgID, m.config)
	if err != nil {
		return nil, err
	}

	if rev.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return []definitions.MuteTiming{}, nil
	}

	result := make([]definitions.MuteTiming, 0, len(rev.cfg.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.cfg.AlertmanagerConfig.MuteTimeIntervals {
		result = append(result, definitions.MuteTiming{MuteTimeInterval: interval})
	}
	return result, nil
}
