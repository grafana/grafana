package provisioning

import (
	"context"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TimeIntervalService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewTimeIntervalService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TimeIntervalService {
	return &TimeIntervalService{
		configStore:     &alertmanagerConfigStoreImpl{store: config},
		provenanceStore: prov,
		xact:            xact,
		log:             log,
	}
}

// GetTimeIntervals returns a slice of all time intervals within the specified org.
func (svc *TimeIntervalService) GetTimeIntervals(ctx context.Context, orgID int64) ([]definitions.TimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if rev.cfg.AlertmanagerConfig.TimeIntervals == nil {
		return []definitions.TimeInterval{}, nil
	}

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&definitions.TimeInterval{}).ResourceType())
	if err != nil {
		return nil, err
	}

	result := make([]definitions.TimeInterval, 0, len(rev.cfg.AlertmanagerConfig.TimeIntervals))
	for _, interval := range rev.cfg.AlertmanagerConfig.TimeIntervals {
		def := definitions.TimeInterval{TimeInterval: interval}
		if prov, ok := provenances[def.ResourceID()]; ok {
			def.Provenance = definitions.Provenance(prov)
		}
		result = append(result, def)
	}
	return result, nil
}

// GetTimeInterval returns a time interval by name.
func (svc *TimeIntervalService) GetTimeInterval(ctx context.Context, name string, orgID int64) (definitions.TimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.TimeInterval{}, err
	}

	mt, _, err := getTimeInterval(rev, name)
	if err != nil {
		return definitions.TimeInterval{}, err
	}

	result := definitions.TimeInterval{
		TimeInterval: mt,
	}

	prov, err := svc.provenanceStore.GetProvenance(ctx, &result, orgID)
	if err != nil {
		return definitions.TimeInterval{}, err
	}
	result.Provenance = definitions.Provenance(prov)
	return result, nil
}

// CreateTimeInterval adds a new time interval within the specified org. The created time interval is returned.
func (svc *TimeIntervalService) CreateTimeInterval(ctx context.Context, ti definitions.TimeInterval, orgID int64) (definitions.TimeInterval, error) {
	if err := ti.Validate(); err != nil {
		return definitions.TimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.TimeInterval{}, err
	}

	if revision.cfg.AlertmanagerConfig.TimeIntervals == nil {
		revision.cfg.AlertmanagerConfig.TimeIntervals = []config.TimeInterval{}
	}
	for _, existing := range revision.cfg.AlertmanagerConfig.TimeIntervals {
		if ti.Name == existing.Name {
			return definitions.TimeInterval{}, ErrTimeIntervalExists.Errorf("")
		}
	}
	revision.cfg.AlertmanagerConfig.TimeIntervals = append(revision.cfg.AlertmanagerConfig.TimeIntervals, ti.TimeInterval)

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &ti, orgID, models.Provenance(ti.Provenance))
	})
	if err != nil {
		return definitions.TimeInterval{}, err
	}
	return ti, nil
}

// UpdateTimeInterval replaces an existing time interval within the specified org. The replaced time interval is returned. If the time interval does not exist, ErrTimeIntervalNotFound is returned.
func (svc *TimeIntervalService) UpdateTimeInterval(ctx context.Context, ti definitions.TimeInterval, orgID int64) (definitions.TimeInterval, error) {
	if err := ti.Validate(); err != nil {
		return definitions.TimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.TimeInterval{}, err
	}

	if revision.cfg.AlertmanagerConfig.TimeIntervals == nil {
		return definitions.TimeInterval{}, nil
	}

	_, idx, err := getTimeInterval(revision, ti.Name)
	if err != nil {
		return definitions.TimeInterval{}, err
	}
	revision.cfg.AlertmanagerConfig.TimeIntervals[idx] = ti.TimeInterval

	// TODO add diff and noop detection
	// TODO add fail if different provenance
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &ti, orgID, models.Provenance(ti.Provenance))
	})
	if err != nil {
		return definitions.TimeInterval{}, err
	}
	return ti, err
}

// DeleteTimeInterval deletes the time interval with the given name in the given org. If the time interval does not exist, no error is returned.
func (svc *TimeIntervalService) DeleteTimeInterval(ctx context.Context, name string, orgID int64) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if revision.cfg.AlertmanagerConfig.TimeIntervals == nil {
		return nil
	}
	if isTimeIntervalInUse(name, []*definitions.Route{revision.cfg.AlertmanagerConfig.Route}) {
		return ErrTimeIntervalInUse.Errorf("")
	}
	for i, existing := range revision.cfg.AlertmanagerConfig.TimeIntervals {
		if name == existing.Name {
			intervals := revision.cfg.AlertmanagerConfig.TimeIntervals
			revision.cfg.AlertmanagerConfig.TimeIntervals = append(intervals[:i], intervals[i+1:]...)
		}
	}

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		target := definitions.TimeInterval{TimeInterval: config.TimeInterval{Name: name}}
		return svc.provenanceStore.DeleteProvenance(ctx, &target, orgID)
	})
}

func isTimeIntervalInUse(name string, routes []*definitions.Route) bool {
	if len(routes) == 0 {
		return false
	}
	for _, route := range routes {
		for _, mtName := range route.MuteTimeIntervals {
			if mtName == name {
				return true
			}
		}
		if isTimeIntervalInUse(name, route.Routes) {
			return true
		}
	}
	return false
}

func getTimeInterval(rev *cfgRevision, name string) (config.TimeInterval, int, error) {
	if rev.cfg.AlertmanagerConfig.TimeIntervals == nil {
		return config.TimeInterval{}, -1, ErrTimeIntervalNotFound.Errorf("")
	}
	for idx, ti := range rev.cfg.AlertmanagerConfig.TimeIntervals {
		if ti.Name == name {
			return ti, idx, nil
		}
	}
	return config.TimeInterval{}, -1, ErrTimeIntervalNotFound.Errorf("")
}
