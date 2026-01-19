package provisioning

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/prometheus/alertmanager/config"
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
	includeImported        bool
}

func NewMuteTimingService(config alertmanagerConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger, ns AlertRuleNotificationSettingsStore) *MuteTimingService {
	return &MuteTimingService{
		configStore:            config,
		provenanceStore:        prov,
		xact:                   xact,
		log:                    log,
		validator:              validation.ValidateProvenanceRelaxed,
		ruleNotificationsStore: ns,
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
		includeImported:        true,
	}
}

// GetMuteTimings returns a slice of all mute timings within the specified org.
func (svc *MuteTimingService) GetMuteTimings(ctx context.Context, orgID int64) ([]*models.MuteTiming, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	grafanaIntervals, err := svc.getGrafanaMuteTimings(ctx, rev, orgID)
	if err != nil {
		return nil, err
	}

	importedIntervals, err := svc.getImportedMuteTimings(rev)
	if err != nil {
		svc.log.Warn("failed to get imported mute timings", "err", err)
	}

	if len(grafanaIntervals) == 0 && len(importedIntervals) == 0 {
		return []*models.MuteTiming{}, nil
	}

	result := append(grafanaIntervals, importedIntervals...)
	slices.SortFunc(result, func(a, b *models.MuteTiming) int {
		return strings.Compare(a.Name, b.Name)
	})

	return result, nil
}

// GetMuteTiming returns a mute timing by name or UID
func (svc *MuteTimingService) GetMuteTiming(ctx context.Context, nameOrUID string, orgID int64) (*models.MuteTiming, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return &models.MuteTiming{}, err
	}
	return svc.getMuteTiming(ctx, revision, nameOrUID, orgID)
}

func (svc *MuteTimingService) getMuteTiming(ctx context.Context, revision *legacy_storage.ConfigRevision, nameOrUID string, orgID int64) (*models.MuteTiming, error) {
	result, found, err := svc.getMuteTimingByName(ctx, revision, orgID, nameOrUID)
	if err != nil {
		return &models.MuteTiming{}, err
	}
	if found {
		return result, nil
	}

	result, found, err = svc.getMuteTimingByUID(ctx, revision, orgID, nameOrUID)
	if err != nil {
		return &models.MuteTiming{}, err
	}
	if found {
		return result, nil
	}

	return &models.MuteTiming{}, ErrTimeIntervalNotFound.Errorf("")
}

// CreateMuteTiming adds a new mute timing within the specified org. The created mute timing is returned.
func (svc *MuteTimingService) CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*models.MuteTiming, error) {
	if err := mt.Validate(); err != nil {
		return &models.MuteTiming{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return &models.MuteTiming{}, err
	}

	if idx := slices.IndexFunc(
		getGrafanaConfigIntervals(revision),
		func(mti config.MuteTimeInterval) bool { return mti.Name == mt.Name }); idx != -1 {
		return &models.MuteTiming{}, ErrTimeIntervalExists.Errorf("")
	}

	revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, config.TimeInterval(mt.MuteTimeInterval))

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &mt, orgID, models.Provenance(mt.Provenance))
	})
	if err != nil {
		return &models.MuteTiming{}, err
	}

	return legacy_storage.ConfigMuteTimeIntervalToMuteTiming(mt.MuteTimeInterval, models.Provenance(mt.Provenance), models.ResourceOriginGrafana), nil
}

// UpdateMuteTiming replaces an existing mute timing within the specified org. The replaced mute timing is returned. If the mute timing does not exist, ErrMuteTimingsNotFound is returned.
func (svc *MuteTimingService) UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (*models.MuteTiming, error) {
	if err := mt.Validate(); err != nil {
		return &models.MuteTiming{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return &models.MuteTiming{}, err
	}

	var found bool
	var existing *models.MuteTiming
	if mt.UID != "" {
		existing, found, err = svc.getMuteTimingByUID(ctx, revision, orgID, mt.UID)
	} else {
		existing, found, err = svc.getMuteTimingByName(ctx, revision, orgID, mt.Name)
	}
	if err != nil {
		return &models.MuteTiming{}, err
	} else if !found {
		return &models.MuteTiming{}, ErrTimeIntervalNotFound.Errorf("")
	}

	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return &models.MuteTiming{}, makeErrMuteTimingOrigin(existing, "update")
	}

	// check that provenance is not changed in an invalid way
	if err := svc.validator(existing.Provenance, models.Provenance(mt.Provenance)); err != nil {
		return &models.MuteTiming{}, err
	}

	// check optimistic concurrency
	if err = svc.checkOptimisticConcurrency(existing, models.Provenance(mt.Provenance), mt.Version, "update"); err != nil {
		return &models.MuteTiming{}, err
	}

	// TODO add diff and noop detection
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		// if the name of the time interval changed
		if existing.Name != mt.Name {
			deleteTimeInterval(revision, existing.MuteTimeInterval)
			revision.Config.AlertmanagerConfig.TimeIntervals = append(revision.Config.AlertmanagerConfig.TimeIntervals, config.TimeInterval(mt.MuteTimeInterval))

			err = svc.renameTimeIntervalInDependentResources(ctx, orgID, revision.Config.AlertmanagerConfig.Route, existing.Name, mt.Name, models.Provenance(mt.Provenance))
			if err != nil {
				return err
			}

			err = svc.provenanceStore.DeleteProvenance(ctx, existing, orgID)
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
		return &models.MuteTiming{}, err
	}

	return legacy_storage.ConfigMuteTimeIntervalToMuteTiming(mt.MuteTimeInterval, models.Provenance(mt.Provenance), models.ResourceOriginGrafana), nil
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
	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return makeErrMuteTimingOrigin(existing, "delete")
	}

	if err := svc.validator(models.Provenance(existing.Provenance), models.Provenance(provenance)); err != nil {
		return err
	}

	if isTimeIntervalInUseInRoutes(existing.Name, revision.Config.AlertmanagerConfig.Route) {
		ns, _ := svc.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, TimeIntervalName: existing.Name})
		// ignore error here because it's not important
		return MakeErrTimeIntervalInUse(true, maps.Keys(ns))
	}

	if err = svc.checkOptimisticConcurrency(existing, models.Provenance(provenance), version, "delete"); err != nil {
		return err
	}
	deleteTimeInterval(revision, existing.MuteTimeInterval)

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
		return svc.provenanceStore.DeleteProvenance(ctx, existing, orgID)
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

func (svc *MuteTimingService) getMuteTimingByName(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, name string) (*models.MuteTiming, bool, error) {
	grafanaIntervals, err := svc.getGrafanaMuteTimings(ctx, revision, orgID)
	if err != nil {
		return nil, false, err
	}

	findByName := func(mt *models.MuteTiming) bool {
		return mt.Name == name
	}

	if idx := slices.IndexFunc(grafanaIntervals, findByName); idx != -1 {
		return grafanaIntervals[idx], true, nil
	}

	return &models.MuteTiming{}, false, nil
}

func (svc *MuteTimingService) getMuteTimingByUID(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, uid string) (*models.MuteTiming, bool, error) {
	grafanaIntervals, err := svc.getGrafanaMuteTimings(ctx, revision, orgID)
	if err != nil {
		return nil, false, err
	}

	findByUID := func(mt *models.MuteTiming) bool {
		return legacy_storage.NameToUid(mt.Name) == uid
	}

	if idx := slices.IndexFunc(grafanaIntervals, findByUID); idx != -1 {
		return grafanaIntervals[idx], true, nil
	}

	importedIntervals, err := svc.getImportedMuteTimings(revision)
	if err != nil {
		svc.log.Warn("failed to get imported mute timings", "err", err)
		return nil, false, nil
	}

	if len(importedIntervals) > 0 {
		if idx := slices.IndexFunc(importedIntervals, findByUID); idx != -1 {
			return importedIntervals[idx], true, nil
		}
	}

	return &models.MuteTiming{}, false, nil
}

func (svc *MuteTimingService) getImportedMuteTimings(rev *legacy_storage.ConfigRevision) ([]*models.MuteTiming, error) {
	if !svc.includeImported {
		return nil, nil
	}

	imported, err := rev.Imported()
	if err != nil {
		return nil, fmt.Errorf("failed to load imported revision: %w", err)
	}

	return imported.GetMuteTimings()
}

// getGrafanaConfigIntervals is a helper to return only the grafana config intervals, without any conversions or
// provenance data (used for name collision checks against grafana intervals only)
func getGrafanaConfigIntervals(rev *legacy_storage.ConfigRevision) []config.MuteTimeInterval {
	result := make([]config.MuteTimeInterval, 0, len(rev.Config.AlertmanagerConfig.TimeIntervals)+len(rev.Config.AlertmanagerConfig.MuteTimeIntervals))
	for _, interval := range rev.Config.AlertmanagerConfig.TimeIntervals {
		result = append(result, config.MuteTimeInterval(interval))
	}
	result = append(result, rev.Config.AlertmanagerConfig.MuteTimeIntervals...)
	return result
}

func (svc *MuteTimingService) getGrafanaMuteTimings(ctx context.Context, rev *legacy_storage.ConfigRevision, orgID int64) ([]*models.MuteTiming, error) {
	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&models.MuteTiming{}).ResourceType())
	if err != nil {
		return nil, err
	}

	result := make([]*models.MuteTiming, 0, len(rev.Config.AlertmanagerConfig.TimeIntervals)+len(rev.Config.AlertmanagerConfig.MuteTimeIntervals))
	pushModel := func(mti config.MuteTimeInterval) {
		prov, ok := provenances[(&models.MuteTiming{MuteTimeInterval: mti}).ResourceID()]
		if !ok {
			prov = models.ProvenanceNone
		}
		result = append(result, legacy_storage.ConfigMuteTimeIntervalToMuteTiming(mti, prov, models.ResourceOriginGrafana))
	}

	for _, interval := range rev.Config.AlertmanagerConfig.TimeIntervals {
		pushModel(config.MuteTimeInterval(interval))
	}

	for _, interval := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		pushModel(interval)
	}

	return result, nil
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

func (svc *MuteTimingService) checkOptimisticConcurrency(current *models.MuteTiming, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			svc.log.Debug("ignoring optimistic concurrency check because version was not provided", "timeInterval", current.Name, "operation", action)
		}
		return nil
	}
	if current.Version != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of time interval %s does not match current version %s", desiredVersion, current.Name, current.Version)
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
