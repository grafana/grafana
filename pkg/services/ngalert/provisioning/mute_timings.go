package provisioning

import (
	"context"

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

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&definitions.MuteTimeInterval{}).ResourceType())
	if err != nil {
		return nil, err
	}

	result := make([]definitions.MuteTimeInterval, 0, len(rev.cfg.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.cfg.AlertmanagerConfig.MuteTimeIntervals {
		def := definitions.MuteTimeInterval{MuteTimeInterval: interval}
		if prov, ok := provenances[def.ResourceID()]; ok {
			def.Provenance = definitions.Provenance(prov)
		}
		result = append(result, def)
	}
	return result, nil
}

// GetMuteTiming returns a mute timing by name
func (svc *MuteTimingService) GetMuteTiming(ctx context.Context, name string, orgID int64) (definitions.MuteTimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	mt, _, err := getMuteTiming(rev, name)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	result := definitions.MuteTimeInterval{
		MuteTimeInterval: mt,
	}

	prov, err := svc.provenanceStore.GetProvenance(ctx, &result, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	result.Provenance = definitions.Provenance(prov)
	return result, nil
}

// CreateMuteTiming adds a new mute timing within the specified org. The created mute timing is returned.
func (svc *MuteTimingService) CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return definitions.MuteTimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		revision.cfg.AlertmanagerConfig.MuteTimeIntervals = []config.MuteTimeInterval{}
	}
	for _, existing := range revision.cfg.AlertmanagerConfig.MuteTimeIntervals {
		if mt.Name == existing.Name {
			return definitions.MuteTimeInterval{}, ErrTimeIntervalExists.Errorf("")
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
		return definitions.MuteTimeInterval{}, err
	}
	return mt, nil
}

// UpdateMuteTiming replaces an existing mute timing within the specified org. The replaced mute timing is returned. If the mute timing does not exist, ErrMuteTimingsNotFound is returned.
func (svc *MuteTimingService) UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return definitions.MuteTimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return definitions.MuteTimeInterval{}, nil
	}

	_, idx, err := getMuteTiming(revision, mt.Name)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	revision.cfg.AlertmanagerConfig.MuteTimeIntervals[idx] = mt.MuteTimeInterval

	// TODO add diff and noop detection
	// TODO add fail if different provenance
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	return mt, err
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
		return ErrTimeIntervalInUse.Errorf("")
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

func getMuteTiming(rev *cfgRevision, name string) (config.MuteTimeInterval, int, error) {
	if rev.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return config.MuteTimeInterval{}, -1, ErrTimeIntervalNotFound.Errorf("")
	}
	for idx, mt := range rev.cfg.AlertmanagerConfig.MuteTimeIntervals {
		if mt.Name == name {
			return mt, idx, nil
		}
	}
	return config.MuteTimeInterval{}, -1, ErrTimeIntervalNotFound.Errorf("")
}
