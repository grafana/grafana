package provisioning

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/fnv"
	"slices"
	"strings"
	"unsafe"

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
	routeService           timeIntervalRouteRefService
	includeImported        bool
}

type timeIntervalRouteRefService interface {
	RenameTimeIntervalInRoutes(ctx context.Context, rev *legacy_storage.ConfigRevision, oldName string, newName string) map[*definitions.Route]int
}

func NewMuteTimingService(
	config alertmanagerConfigStore,
	prov ProvisioningStore,
	xact TransactionManager,
	log log.Logger,
	ns AlertRuleNotificationSettingsStore,
	routeService timeIntervalRouteRefService,
) *MuteTimingService {
	return &MuteTimingService{
		configStore:            config,
		provenanceStore:        prov,
		xact:                   xact,
		log:                    log,
		validator:              validation.ValidateProvenanceRelaxed,
		ruleNotificationsStore: ns,
		routeService:           routeService,
		includeImported:        false,
	}
}

func (svc *MuteTimingService) WithIncludeImported() *MuteTimingService {
	return &MuteTimingService{
		configStore:            svc.configStore,
		provenanceStore:        svc.provenanceStore,
		xact:                   svc.xact,
		log:                    svc.log,
		validator:              svc.validator,
		ruleNotificationsStore: svc.ruleNotificationsStore,
		routeService:           svc.routeService,
		includeImported:        true,
	}
}

// GetMuteTimings returns a slice of all mute timings within the specified org.
func (svc *MuteTimingService) GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	grafanaIntervals := getGrafanaTimeIntervals(rev)
	importedIntervals := svc.getImportedTimeIntervals(rev)

	if len(grafanaIntervals)+len(importedIntervals) == 0 {
		return []definitions.MuteTimeInterval{}, nil
	}

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&definitions.MuteTimeInterval{}).ResourceType())
	if err != nil {
		return nil, err
	}

	result := make([]definitions.MuteTimeInterval, 0, len(grafanaIntervals))
	for _, interval := range grafanaIntervals {
		prov, ok := provenances[(&definitions.MuteTimeInterval{MuteTimeInterval: interval}).ResourceID()]
		if !ok {
			prov = models.ProvenanceNone
		}

		result = append(result, newMuteTimingInterval(interval, definitions.Provenance(prov)))
	}

	for _, interval := range importedIntervals {
		result = append(result, newMuteTimingInterval(interval, definitions.Provenance(models.ProvenanceConvertedPrometheus)))
	}

	slices.SortFunc(result, func(a, b definitions.MuteTimeInterval) int {
		return strings.Compare(a.Name, b.Name)
	})

	return result, nil
}

// GetMuteTimingByUID returns a mute timing by UID
func (svc *MuteTimingService) GetMuteTimingByUID(ctx context.Context, uid string, orgID int64) (definitions.MuteTimeInterval, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	result, found, err := svc.getMuteTimingByUID(ctx, revision, orgID, uid)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	if found {
		return result, nil
	}

	return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
}

// GetMuteTimingByName returns a mute timing by name.
func (svc *MuteTimingService) GetMuteTimingByName(ctx context.Context, name string, orgID int64) (definitions.MuteTimeInterval, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	mti, found, err := svc.getMuteTimingByName(ctx, revision, orgID, name)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	} else if !found {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	return mti, nil
}

// getMuteTiming is a helper that tries to get a mute timing by name first, then UID if not found by name.
func (svc *MuteTimingService) getMuteTiming(ctx context.Context, revision *legacy_storage.ConfigRevision, nameOrUID string, orgID int64) (definitions.MuteTimeInterval, error) {
	result, found, err := svc.getMuteTimingByName(ctx, revision, orgID, nameOrUID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	if found {
		return result, nil
	}

	result, found, err = svc.getMuteTimingByUID(ctx, revision, orgID, nameOrUID)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	if found {
		return result, nil
	}

	return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
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

	if grafanaTimeIntervalExists(revision, mt.Name) {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalExists.Errorf("")
	}

	revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, definitions.TimeInterval(mt.MuteTimeInterval))

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	return newMuteTimingInterval(mt.MuteTimeInterval, mt.Provenance), nil
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

	var found bool
	var existing definitions.MuteTimeInterval
	if mt.UID != "" {
		existing, found, err = svc.getMuteTimingByUID(ctx, revision, orgID, mt.UID)
	} else {
		existing, found, err = svc.getMuteTimingByName(ctx, revision, orgID, mt.Name)
	}
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	} else if !found {
		return definitions.MuteTimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	if existing.Name != mt.Name { // if mute timing is renamed, check if this name is already taken
		if grafanaTimeIntervalExists(revision, mt.Name) {
			return definitions.MuteTimeInterval{}, ErrTimeIntervalExists.Errorf("")
		}
	}

	if existing.Provenance == definitions.Provenance(models.ProvenanceConvertedPrometheus) {
		return definitions.MuteTimeInterval{}, makeErrMuteTimeIntervalOrigin(existing, "update")
	}

	// check that provenance is not changed in an invalid way
	if err := svc.validator(models.Provenance(existing.Provenance), models.Provenance(mt.Provenance)); err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	existingInterval := existing.MuteTimeInterval

	// check optimistic concurrency
	if err = svc.checkOptimisticConcurrency(existingInterval, models.Provenance(mt.Provenance), mt.Version, "update"); err != nil {
		return definitions.MuteTimeInterval{}, err
	}

	// TODO add diff and noop detection
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		// if the name of the time interval changed
		if existingInterval.Name != mt.Name {
			deleteTimeInterval(revision, existingInterval)
			revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, definitions.TimeInterval(mt.MuteTimeInterval))

			err = svc.renameTimeIntervalInDependentResources(ctx, orgID, revision, existingInterval.Name, mt.Name, models.Provenance(mt.Provenance))
			if err != nil {
				return err
			}

			err = svc.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
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

	return newMuteTimingInterval(mt.MuteTimeInterval, mt.Provenance), nil
}

// DeleteMuteTiming deletes the mute timing with the given name in the given org. If the mute timing does not exist, no error is returned.
func (svc *MuteTimingService) DeleteMuteTiming(ctx context.Context, nameOrUID string, orgID int64, provenance definitions.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, err := svc.getMuteTiming(ctx, revision, nameOrUID, orgID)
	if err != nil && !errors.Is(err, ErrTimeIntervalNotFound) {
		return err
	} else if errors.Is(err, ErrTimeIntervalNotFound) {
		return nil
	}

	// Block deletes of imported intervals
	if existing.Provenance == definitions.Provenance(models.ProvenanceConvertedPrometheus) {
		return makeErrMuteTimeIntervalOrigin(existing, "delete")
	}

	existingInterval := existing.MuteTimeInterval
	target := definitions.MuteTimeInterval{MuteTimeInterval: existingInterval, Provenance: provenance}

	if err := svc.validator(models.Provenance(existing.Provenance), models.Provenance(provenance)); err != nil {
		return err
	}

	if isTimeIntervalInUseInRoutes(existing.Name, revision.Config.AlertmanagerConfig.Route) {
		ns, _ := svc.ruleNotificationsStore.ListContactPointRoutings(ctx, models.ListContactPointRoutingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
		// ignore error here because it's not important
		return MakeErrTimeIntervalInUse(true, maps.Keys(ns))
	}

	if err = svc.checkOptimisticConcurrency(existingInterval, models.Provenance(provenance), version, "delete"); err != nil {
		return err
	}
	deleteTimeInterval(revision, existingInterval)

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		keys, err := svc.ruleNotificationsStore.ListContactPointRoutings(ctx, models.ListContactPointRoutingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
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

func isTimeIntervalInUseInRoutes(name string, route *definitions.Route) bool {
	if route == nil {
		return false
	}
	if slices.Contains(route.MuteTimeIntervals, name) {
		return true
	}

	if slices.Contains(route.ActiveTimeIntervals, name) {
		return true
	}

	for _, route := range route.Routes {
		if isTimeIntervalInUseInRoutes(name, route) {
			return true
		}
	}
	return false
}

func (svc *MuteTimingService) getMuteTimingByName(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, name string) (definitions.MuteTimeInterval, bool, error) {
	grafanaIntervals := getGrafanaTimeIntervals(revision)
	if idx := slices.IndexFunc(grafanaIntervals, findByName(name)); idx != -1 {
		interval := grafanaIntervals[idx]

		prov, err := svc.provenanceStore.GetProvenance(ctx, &definitions.MuteTimeInterval{UID: legacy_storage.NameToUid(interval.Name), MuteTimeInterval: interval}, orgID)
		if err != nil {
			return definitions.MuteTimeInterval{}, false, err
		}

		return newMuteTimingInterval(interval, definitions.Provenance(prov)), true, nil
	}

	return definitions.MuteTimeInterval{}, false, nil
}

func (svc *MuteTimingService) getMuteTimingByUID(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, uid string) (definitions.MuteTimeInterval, bool, error) {
	grafanaIntervals := getGrafanaTimeIntervals(revision)
	if idx := slices.IndexFunc(grafanaIntervals, findByUID(uid)); idx != -1 {
		interval := grafanaIntervals[idx]

		prov, err := svc.provenanceStore.GetProvenance(ctx, &definitions.MuteTimeInterval{UID: legacy_storage.NameToUid(interval.Name), MuteTimeInterval: interval}, orgID)
		if err != nil {
			return definitions.MuteTimeInterval{}, false, err
		}

		return newMuteTimingInterval(interval, definitions.Provenance(prov)), true, nil
	}

	if importedIntervals := svc.getImportedTimeIntervals(revision); len(importedIntervals) > 0 {
		if idx := slices.IndexFunc(importedIntervals, findByUID(uid)); idx != -1 {
			interval := importedIntervals[idx]

			return newMuteTimingInterval(interval, definitions.Provenance(models.ProvenanceConvertedPrometheus)), true, nil
		}
	}

	return definitions.MuteTimeInterval{}, false, nil
}

func (svc *MuteTimingService) getImportedTimeIntervals(rev *legacy_storage.ConfigRevision) []definitions.AmMuteTimeInterval {
	if !svc.includeImported {
		return nil
	}

	imported, err := rev.Imported()
	if err != nil {
		svc.log.Warn("failed to get imported config revision for mute time intervals", "error", err)
		return nil
	}

	intervals, err := imported.GetMuteTimeIntervals()
	if err != nil {
		svc.log.Warn("failed to get imported mute time intervals", "error", err)
		return nil
	}

	return intervals
}

func findByName(name string) func(definitions.AmMuteTimeInterval) bool {
	return func(interval definitions.AmMuteTimeInterval) bool {
		return interval.Name == name
	}
}

func findByUID(uid string) func(definitions.AmMuteTimeInterval) bool {
	return func(interval definitions.AmMuteTimeInterval) bool {
		return legacy_storage.NameToUid(interval.Name) == uid
	}
}

func getGrafanaTimeIntervals(rev *legacy_storage.ConfigRevision) []definitions.AmMuteTimeInterval {
	result := make([]definitions.AmMuteTimeInterval, 0, len(rev.Config.AlertmanagerConfig.TimeIntervals)+len(rev.Config.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.Config.AlertmanagerConfig.TimeIntervals {
		result = append(result, definitions.AmMuteTimeInterval(interval))
	}
	return append(result, rev.Config.AlertmanagerConfig.MuteTimeIntervals...)
}

func grafanaTimeIntervalExists(rev *legacy_storage.ConfigRevision, name string) bool {
	grafanaIntervals := getGrafanaTimeIntervals(rev)
	return slices.IndexFunc(grafanaIntervals, findByName(name)) != -1
}

func updateTimeInterval(rev *legacy_storage.ConfigRevision, interval definitions.AmMuteTimeInterval) {
	for idx := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		if rev.Config.AlertmanagerConfig.MuteTimeIntervals[idx].Name == interval.Name {
			rev.Config.AlertmanagerConfig.MuteTimeIntervals[idx] = interval
			return
		}
	}
	for idx := range rev.Config.AlertmanagerConfig.TimeIntervals {
		if rev.Config.AlertmanagerConfig.TimeIntervals[idx].Name == interval.Name {
			rev.Config.AlertmanagerConfig.TimeIntervals[idx] = definitions.TimeInterval(interval)
			return
		}
	}
}

func deleteTimeInterval(rev *legacy_storage.ConfigRevision, interval definitions.AmMuteTimeInterval) {
	rev.Config.AlertmanagerConfig.MuteTimeIntervals = slices.DeleteFunc(rev.Config.AlertmanagerConfig.MuteTimeIntervals, findByName(interval.Name))
	rev.Config.AlertmanagerConfig.TimeIntervals = slices.DeleteFunc(rev.Config.AlertmanagerConfig.TimeIntervals, func(i definitions.TimeInterval) bool {
		return i.Name == interval.Name
	})
}

func calculateMuteTimeIntervalFingerprint(interval definitions.AmMuteTimeInterval) string {
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

func (svc *MuteTimingService) checkOptimisticConcurrency(current definitions.AmMuteTimeInterval, provenance models.Provenance, desiredVersion string, action string) error {
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

func (svc *MuteTimingService) renameTimeIntervalInDependentResources(ctx context.Context, orgID int64, rev *legacy_storage.ConfigRevision, oldName, newName string, timeIntervalProvenance models.Provenance) error {
	validate := validation.ValidateProvenanceOfDependentResources(timeIntervalProvenance)
	// if there are no references to the old time interval, exit
	canUpdate := true
	updatedRouteCnt := 0
	if updatedRoutes := svc.routeService.RenameTimeIntervalInRoutes(ctx, rev, oldName, newName); len(updatedRoutes) > 0 {
		for route, updatedCnt := range updatedRoutes {
			if updatedCnt > 0 {
				updatedRouteCnt += updatedCnt
				routeProvenance, err := svc.provenanceStore.GetProvenance(ctx, route, orgID)
				if err != nil {
					return err
				}
				canUpdate = canUpdate && validate(routeProvenance)
			}
		}
	}

	dryRun := !canUpdate
	affected, invalidProvenance, err := svc.ruleNotificationsStore.RenameTimeIntervalInNotificationSettings(ctx, orgID, oldName, newName, validate, dryRun)
	if err != nil {
		return err
	}
	if !canUpdate || len(invalidProvenance) > 0 {
		return MakeErrTimeIntervalDependentResourcesProvenance(updatedRouteCnt > 0, invalidProvenance)
	}
	if len(affected) > 0 || updatedRouteCnt > 0 {
		svc.log.FromContext(ctx).Info("Updated rules and routes that use renamed time interval", "oldName", oldName, "newName", newName, "rules", len(affected), "routes", updatedRouteCnt)
	}
	return nil
}

func newMuteTimingInterval(interval definitions.AmMuteTimeInterval, provenance definitions.Provenance) definitions.MuteTimeInterval {
	return definitions.MuteTimeInterval{
		UID:              legacy_storage.NameToUid(interval.Name),
		MuteTimeInterval: interval,
		Version:          calculateMuteTimeIntervalFingerprint(interval),
		Provenance:       provenance,
	}
}
