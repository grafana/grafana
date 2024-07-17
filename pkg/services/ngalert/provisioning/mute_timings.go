package provisioning

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"slices"
	"unsafe"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type MuteTimingService struct {
	configStore            alertmanagerConfigStore
	provenanceStore        ProvisioningStore
	xact                   TransactionManager
	log                    log.Logger
	validator              validation.ProvenanceStatusTransitionValidator
	ruleNotificationsStore AlertRuleNotificationSettingsStore
}

func NewMuteTimingService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger, ns AlertRuleNotificationSettingsStore) *MuteTimingService {
	return &MuteTimingService{
		configStore:            &alertmanagerConfigStoreImpl{store: config},
		provenanceStore:        prov,
		xact:                   xact,
		log:                    log,
		validator:              validation.ValidateProvenanceRelaxed,
		ruleNotificationsStore: ns,
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
		version := calculateMuteTimeIntervalFingerprint(interval)
		def := definitions.MuteTimeInterval{MuteTimeInterval: interval, Version: version}
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

	mt, idx := getMuteTiming(rev, name)
	if idx == -1 {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	result := definitions.MuteTimeInterval{
		MuteTimeInterval: mt,
		Version:          calculateMuteTimeIntervalFingerprint(mt),
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

	_, idx := getMuteTiming(revision, mt.Name)
	if idx != -1 {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalExists.Errorf("")
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
	return definitions.MuteTimeInterval{
		MuteTimeInterval: mt.MuteTimeInterval,
		Version:          calculateMuteTimeIntervalFingerprint(mt.MuteTimeInterval),
		Provenance:       mt.Provenance,
	}, nil
}

// UpdateMuteTiming replaces an existing mute timing within the specified org. The replaced mute timing is returned. If the mute timing does not exist, ErrMuteTimingsNotFound is returned.
func (svc *MuteTimingService) UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return definitions.MuteTimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := svc.provenanceStore.GetProvenance(ctx, &mt, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	if err := svc.validator(storedProvenance, models.Provenance(mt.Provenance)); err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	if revision.cfg.AlertmanagerConfig.MuteTimeIntervals == nil {
		return definitions.MuteTimeInterval{}, nil
	}

	old, idx := getMuteTiming(revision, mt.Name)
	if idx == -1 {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	err = svc.checkOptimisticConcurrency(old, models.Provenance(mt.Provenance), mt.Version, "update")
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	revision.cfg.AlertmanagerConfig.MuteTimeIntervals[idx] = mt.MuteTimeInterval

	// TODO add diff and noop detection
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	return definitions.MuteTimeInterval{
		MuteTimeInterval: mt.MuteTimeInterval,
		Version:          calculateMuteTimeIntervalFingerprint(mt.MuteTimeInterval),
		Provenance:       mt.Provenance,
	}, err
}

// DeleteMuteTiming deletes the mute timing with the given name in the given org. If the mute timing does not exist, no error is returned.
func (svc *MuteTimingService) DeleteMuteTiming(ctx context.Context, name string, orgID int64, provenance definitions.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, idx := getMuteTiming(revision, name)
	if idx == -1 {
		svc.log.FromContext(ctx).Debug("Time interval was not found. Skip deleting", "name", name)
		return nil
	}

	target := definitions.MuteTimeInterval{MuteTimeInterval: existing, Provenance: provenance}
	// check that provenance is not changed in an invalid way
	storedProvenance, err := svc.provenanceStore.GetProvenance(ctx, &target, orgID)
	if err != nil {
		return err
	}
	if err := svc.validator(storedProvenance, models.Provenance(provenance)); err != nil {
		return err
	}

	if isMuteTimeInUseInRoutes(name, revision.cfg.AlertmanagerConfig.Route) {
		ns, _ := svc.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
		// ignore error here because it's not important
		return MakeErrTimeIntervalInUse(true, maps.Keys(ns))
	}

	err = svc.checkOptimisticConcurrency(existing, models.Provenance(provenance), version, "delete")
	if err != nil {
		return err
	}
	revision.cfg.AlertmanagerConfig.MuteTimeIntervals = slices.Delete(revision.cfg.AlertmanagerConfig.MuteTimeIntervals, idx, idx+1)

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		keys, err := svc.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			return MakeErrTimeIntervalInUse(false, maps.Keys(keys))
		}

		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.DeleteProvenance(ctx, &target, orgID)
	})
}

func isMuteTimeInUseInRoutes(name string, route *definitions.Route) bool {
	if route == nil {
		return false
	}
	if slices.Contains(route.MuteTimeIntervals, name) {
		return true
	}
	for _, route := range route.Routes {
		if isMuteTimeInUseInRoutes(name, route) {
			return true
		}
	}
	return false
}

func getMuteTiming(rev *cfgRevision, name string) (config.MuteTimeInterval, int) {
	idx := slices.IndexFunc(rev.cfg.AlertmanagerConfig.MuteTimeIntervals, func(interval config.MuteTimeInterval) bool {
		return interval.Name == name
	})
	if idx == -1 {
		return config.MuteTimeInterval{}, idx
	}
	return rev.cfg.AlertmanagerConfig.MuteTimeIntervals[idx], idx
}

func calculateMuteTimeIntervalFingerprint(interval config.MuteTimeInterval) string {
	sum := fnv.New64()

	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		// add a byte sequence that cannot happen in UTF-8 strings.
		_, _ = sum.Write([]byte{255})
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}
	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}

	writeRange := func(r timeinterval.InclusiveRange) {
		writeInt(r.Begin)
		writeInt(r.End)
	}

	// fields that determine the rule state
	writeString(interval.Name)
	for _, ti := range interval.TimeIntervals {
		for _, time := range ti.Times {
			writeInt(time.StartMinute)
			writeInt(time.EndMinute)
		}
		for _, itm := range ti.Months {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.DaysOfMonth {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.Weekdays {
			writeRange(itm.InclusiveRange)
		}
		for _, itm := range ti.Years {
			writeRange(itm.InclusiveRange)
		}
		if ti.Location != nil {
			writeString(ti.Location.String())
		}
	}
	return fmt.Sprintf("%016x", sum.Sum64())
}

func (svc *MuteTimingService) checkOptimisticConcurrency(current config.MuteTimeInterval, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			svc.log.Debug("ignoring optimistic concurrency check because version was not provided", "timeInterval", current.Name, "operation", action)
		}
		return nil
	}
	currentVersion := calculateMuteTimeIntervalFingerprint(current)
	if currentVersion != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of time interval %s does not match current version %s", desiredVersion, current.Name, currentVersion)
	}
	return nil
}
