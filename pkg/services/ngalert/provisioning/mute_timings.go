package provisioning

import (
	"context"
	"fmt"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type MuteTimingService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewMuteTimingService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *MuteTimingService {
	return &MuteTimingService{
		configStore:     &alertmanagerConfigStoreImpl{store: config},
		provenanceStore: prov,
		xact:            xact,
		log:             log,
	}
}

// GetMuteTimings returns a slice of all mute timings within the specified org.
func (svc *MuteTimingService) GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if rev.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return []definitions.MuteTimeInterval{}, nil
	}

	result := make([]definitions.MuteTimeInterval, 0, len(rev.cfg.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.cfg.AlertmanagerConfig.MuteTimeIntervals {
		result = append(result, definitions.MuteTimeInterval{MuteTimeInterval: interval})
	}
	return result, nil
}

// CreateMuteTiming adds a new mute timing within the specified org. The created mute timing is returned.
func (svc *MuteTimingService) CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*definitions.MuteTimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		revision.cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{}
	}
	for _, existing := range revision.cfg.AlertmanagerConfig.MuteTimeIntervals {
		if mt.Name == existing.Name {
			return nil, fmt.Errorf("%w: %s", ErrValidation, "a mute timing with this name already exists")
		}
	}
	revision.cfg.AlertmanagerConfig.MuteTimeIntervals = append(revision.cfg.AlertmanagerConfig.MuteTimeIntervals, mt.MuteTimeInterval)

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return nil, err
	}
	return &mt, nil
}

// UpdateMuteTiming replaces an existing mute timing within the specified org. The replaced mute timing is returned. If the mute timing does not exist, nil is returned and no action is taken.
func (svc *MuteTimingService) UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*definitions.MuteTimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return nil, nil
	}
	updated := false
	for i, existing := range revision.cfg.AlertmanagerConfig.MuteTimeIntervals {
		if mt.Name == existing.Name {
			revision.cfg.AlertmanagerConfig.MuteTimeIntervals[i] = mt.MuteTimeInterval
			updated = true
			break
		}
	}
	if !updated {
		return nil, nil
	}

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return nil, err
	}
	return &mt, err
}

// DeleteMuteTiming deletes the mute timing with the given name in the given org. If the mute timing does not exist, no error is returned.
func (svc *MuteTimingService) DeleteMuteTiming(ctx context.Context, name string, orgID int64) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return nil
	}
	if isMuteTimeInUse(name, []*definitions.Route{revision.cfg.AlertmanagerConfig.Route}) {
		return fmt.Errorf("mute time '%s' is currently used by a notification policy", name)
	}
	for i, existing := range revision.cfg.AlertmanagerConfig.MuteTimeIntervals {
		if name == existing.Name {
			intervals := revision.cfg.AlertmanagerConfig.MuteTimeIntervals
			revision.cfg.AlertmanagerConfig.MuteTimeIntervals = append(intervals[:i], intervals[i+1:]...)
		}
	}

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		target := definitions.MuteTimeInterval{MuteTimeInterval: config.MuteTimeInterval{Name: name}}
		return svc.provenanceStore.DeleteProvenance(ctx, &target, orgID)
	})
}

func isMuteTimeInUse(name string, routes []*definitions.Route) bool {
	if len(routes) == 0 {
		return false
	}
	for _, route := range routes {
		for _, mtName := range route.MuteTimeIntervals {
			if mtName == name {
				return true
			}
		}
		if isMuteTimeInUse(name, route.Routes) {
			return true
		}
	}
	return false
}
