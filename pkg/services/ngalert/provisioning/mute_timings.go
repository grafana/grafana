package provisioning

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"slices"
	"strings"
	"unsafe"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
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

func NewMuteTimingService(config alertmanagerConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger, ns AlertRuleNotificationSettingsStore) *MuteTimingService {
	return &MuteTimingService{
		configStore:            config,
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

	intervals := getTimeIntervals(rev)

	if len(intervals) == 0 {
		return []definitions.MuteTimeInterval{}, nil
	}

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&definitions.MuteTimeInterval{}).ResourceType())
	if err != nil {
		return nil, err
	}

	slices.SortFunc(intervals, func(a, b config.MuteTimeInterval) int {
		return strings.Compare(a.Name, b.Name)
	})
	result := make([]definitions.MuteTimeInterval, 0, len(intervals))
	for _, interval := range intervals {
		version := calculateMuteTimeIntervalFingerprint(interval)
		def := definitions.MuteTimeInterval{
			UID:              legacy_storage.NameToUid(interval.Name),
			MuteTimeInterval: interval,
			Version:          version,
		}
		if prov, ok := provenances[def.ResourceID()]; ok {
			def.Provenance = definitions.Provenance(prov)
		}
		result = append(result, def)
	}
	return result, nil
}

// GetMuteTiming returns a mute timing by name
func (svc *MuteTimingService) GetMuteTiming(ctx context.Context, nameOrUID string, orgID int64) (definitions.MuteTimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	mt, found := getMuteTimingByName(rev, nameOrUID)
	if !found {
		name, err := legacy_storage.UidToName(nameOrUID)
		if err == nil {
			mt, found = getMuteTimingByName(rev, name)
		}
	}
	if !found {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	result := definitions.MuteTimeInterval{
		UID:              legacy_storage.NameToUid(mt.Name),
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

	_, found := getMuteTimingByName(revision, mt.Name)
	if found {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalExists.Errorf("")
	}
	revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, config.TimeInterval(mt.MuteTimeInterval))

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
		UID:              legacy_storage.NameToUid(mt.Name),
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

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	var old config.MuteTimeInterval
	found := false
	if mt.UID != "" {
		name, err := legacy_storage.UidToName(mt.UID)
		if err == nil {
			old, found = getMuteTimingByName(revision, name)
		}
	} else {
		old, found = getMuteTimingByName(revision, mt.Name)
	}
	if !found {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	// check optimistic concurrency
	err = svc.checkOptimisticConcurrency(old, models.Provenance(mt.Provenance), mt.Version, "update")
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := svc.provenanceStore.GetProvenance(ctx, &definitions.MuteTimeInterval{MuteTimeInterval: old}, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	if err := svc.validator(storedProvenance, models.Provenance(mt.Provenance)); err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	// TODO add diff and noop detection
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		// if the name of the time interval changed
		if old.Name != mt.Name {
			deleteTimeInterval(revision, old)
			revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, config.TimeInterval(mt.MuteTimeInterval))

			err = svc.renameTimeIntervalInDependentResources(ctx, orgID, revision.Config.AlertmanagerConfig.Route, old.Name, mt.Name, models.Provenance(mt.Provenance))
			if err != nil {
				return err
			}

			err = svc.provenanceStore.DeleteProvenance(ctx, &definitions.MuteTimeInterval{MuteTimeInterval: old}, orgID)
			if err != nil {
				return err
			}
		} else {
			updateTimeInterval(revision, mt.MuteTimeInterval)
		}
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	return definitions.MuteTimeInterval{
		UID:              legacy_storage.NameToUid(mt.Name),
		MuteTimeInterval: mt.MuteTimeInterval,
		Version:          calculateMuteTimeIntervalFingerprint(mt.MuteTimeInterval),
		Provenance:       mt.Provenance,
	}, err
}

// DeleteMuteTiming deletes the mute timing with the given name in the given org. If the mute timing does not exist, no error is returned.
func (svc *MuteTimingService) DeleteMuteTiming(ctx context.Context, nameOrUID string, orgID int64, provenance definitions.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, found := getMuteTimingByName(revision, nameOrUID)
	if !found {
		name, err := legacy_storage.UidToName(nameOrUID)
		if err == nil {
			existing, found = getMuteTimingByName(revision, name)
		}
	}
	if !found {
		svc.log.FromContext(ctx).Debug("Time interval was not found. Skip deleting", "name", nameOrUID)
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

	if isMuteTimeInUseInRoutes(existing.Name, revision.Config.AlertmanagerConfig.Route) {
		ns, _ := svc.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
		// ignore error here because it's not important
		return MakeErrTimeIntervalInUse(true, maps.Keys(ns))
	}

	err = svc.checkOptimisticConcurrency(existing, models.Provenance(provenance), version, "delete")
	if err != nil {
		return err
	}
	deleteTimeInterval(revision, existing)

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

func getMuteTimingByName(rev *legacy_storage.ConfigRevision, name string) (config.MuteTimeInterval, bool) {
	intervals := getTimeIntervals(rev)
	idx := slices.IndexFunc(intervals, func(interval config.MuteTimeInterval) bool {
		return interval.Name == name
	})
	if idx == -1 {
		return config.MuteTimeInterval{}, false
	}
	return intervals[idx], true
}

func getTimeIntervals(rev *legacy_storage.ConfigRevision) []config.MuteTimeInterval {
	result := make([]config.MuteTimeInterval, 0, len(rev.Config.AlertmanagerConfig.TimeIntervals)+len(rev.Config.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.Config.AlertmanagerConfig.TimeIntervals {
		result = append(result, config.MuteTimeInterval(interval))
	}
	return append(result, rev.Config.AlertmanagerConfig.MuteTimeIntervals...)
}

func updateTimeInterval(rev *legacy_storage.ConfigRevision, interval config.MuteTimeInterval) {
	for idx := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		if rev.Config.AlertmanagerConfig.MuteTimeIntervals[idx].Name == interval.Name {
			rev.Config.AlertmanagerConfig.MuteTimeIntervals[idx] = interval
			return
		}
	}
	for idx := range rev.Config.AlertmanagerConfig.TimeIntervals {
		if rev.Config.AlertmanagerConfig.TimeIntervals[idx].Name == interval.Name {
			rev.Config.AlertmanagerConfig.TimeIntervals[idx] = config.TimeInterval(interval)
			return
		}
	}
}

func deleteTimeInterval(rev *legacy_storage.ConfigRevision, interval config.MuteTimeInterval) {
	rev.Config.AlertmanagerConfig.MuteTimeIntervals = slices.DeleteFunc(rev.Config.AlertmanagerConfig.MuteTimeIntervals, func(i config.MuteTimeInterval) bool {
		return i.Name == interval.Name
	})
	rev.Config.AlertmanagerConfig.TimeIntervals = slices.DeleteFunc(rev.Config.AlertmanagerConfig.TimeIntervals, func(i config.TimeInterval) bool {
		return i.Name == interval.Name
	})
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

func (svc *MuteTimingService) renameTimeIntervalInDependentResources(ctx context.Context, orgID int64, route *definitions.Route, oldName, newName string, timeIntervalProvenance models.Provenance) error {
	validate := validation.ValidateProvenanceOfDependentResources(timeIntervalProvenance)
	// if there are no references to the old time interval, exit
	updatedRoutes := replaceMuteTiming(route, oldName, newName)
	canUpdate := true
	if updatedRoutes > 0 {
		routeProvenance, err := svc.provenanceStore.GetProvenance(ctx, route, orgID)
		if err != nil {
			return err
		}
		canUpdate = validate(routeProvenance)
	}
	dryRun := !canUpdate
	affected, invalidProvenance, err := svc.ruleNotificationsStore.RenameTimeIntervalInNotificationSettings(ctx, orgID, oldName, newName, validate, dryRun)
	if err != nil {
		return err
	}
	if !canUpdate || len(invalidProvenance) > 0 {
		return MakeErrTimeIntervalDependentResourcesProvenance(updatedRoutes > 0, invalidProvenance)
	}
	if len(affected) > 0 || updatedRoutes > 0 {
		svc.log.FromContext(ctx).Info("Updated rules and routes that use renamed time interval", "oldName", oldName, "newName", newName, "rules", len(affected), "routes", updatedRoutes)
	}
	return nil
}

func replaceMuteTiming(route *definitions.Route, oldName, newName string) int {
	if route == nil {
		return 0
	}
	updated := 0
	for idx := range route.MuteTimeIntervals {
		if route.MuteTimeIntervals[idx] == oldName {
			route.MuteTimeIntervals[idx] = newName
			updated++
		}
	}
	for idx := range route.ActiveTimeIntervals {
		if route.ActiveTimeIntervals[idx] == oldName {
			route.ActiveTimeIntervals[idx] = newName
			updated++
		}
	}
	for _, route := range route.Routes {
		updated += replaceMuteTiming(route, oldName, newName)
	}
	return updated
}
