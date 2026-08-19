package provisioning

import (
	"context"
	"maps"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
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
	RenameTimeIntervalInRoutes(ctx context.Context, rev *legacy_storage.ConfigRevision, oldName string, newName string) map[*v1.Route]int
}

func NewMuteTimingService(
	config alertmanagerConfigStore,
	prov ProvisioningStore,
	xact TransactionManager,
	log log.Logger,
	ns AlertRuleNotificationSettingsStore,
	routeService timeIntervalRouteRefService,
	validator validation.ProvenanceStatusTransitionValidator,
) *MuteTimingService {
	return &MuteTimingService{
		configStore:            config,
		provenanceStore:        prov,
		xact:                   xact,
		log:                    log,
		validator:              validator,
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
func (svc *MuteTimingService) GetMuteTimings(ctx context.Context, orgID int64) ([]v1.TimeInterval, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if err := svc.assignTimeIntervalProvenance(ctx, orgID, rev); err != nil {
		return nil, err
	}

	grafanaIntervals := rev.Config.TimeIntervals
	importedIntervals := svc.getImportedTimeIntervals(rev)

	if len(grafanaIntervals)+len(importedIntervals) == 0 {
		return []v1.TimeInterval{}, nil
	}

	result := make([]v1.TimeInterval, 0, len(grafanaIntervals)+len(importedIntervals))
	for _, interval := range grafanaIntervals {
		result = append(result, interval)
	}

	result = append(result, importedIntervals...)

	slices.SortFunc(result, func(a, b v1.TimeInterval) int {
		return strings.Compare(a.Title, b.Title)
	})

	return result, nil
}

// GetMuteTimingByUID returns a mute timing by UID
func (svc *MuteTimingService) GetMuteTimingByUID(ctx context.Context, uid v1.ResourceUID, orgID int64) (v1.TimeInterval, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TimeInterval{}, err
	}

	if err := svc.assignTimeIntervalProvenance(ctx, orgID, revision); err != nil {
		return v1.TimeInterval{}, err
	}

	if result, found := svc.getMuteTimingByUID(revision, uid); found {
		return result, nil
	}

	return v1.TimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
}

// GetMuteTimingByName returns a mute timing by name.
func (svc *MuteTimingService) GetMuteTimingByName(ctx context.Context, name string, orgID int64) (v1.TimeInterval, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TimeInterval{}, err
	}

	if err := svc.assignTimeIntervalProvenance(ctx, orgID, revision); err != nil {
		return v1.TimeInterval{}, err
	}

	if mti, found := revision.GetTimeIntervalWithTitle(name); found {
		return mti, nil
	}

	return v1.TimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
}

// CreateMuteTiming adds a new mute timing within the specified org. The created mute timing is returned.
func (svc *MuteTimingService) CreateMuteTiming(ctx context.Context, mt v1.TimeInterval, orgID int64) (v1.TimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return v1.TimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	if err := svc.validator(ctx, models.ProvenanceNone, mt.Provenance); err != nil {
		return v1.TimeInterval{}, err
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TimeInterval{}, err
	}

	if _, ok := revision.GetTimeIntervalWithTitle(mt.Title); ok {
		return v1.TimeInterval{}, ErrTimeIntervalExists.Errorf("")
	}

	created := revision.SetTimeInterval(mt)

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &created, orgID, created.Provenance)
	})
	if err != nil {
		return v1.TimeInterval{}, err
	}

	return created, nil
}

// UpdateMuteTiming replaces an existing mute timing within the specified org. The replaced mute timing is returned. If the mute timing does not exist, ErrMuteTimingsNotFound is returned.
func (svc *MuteTimingService) UpdateMuteTiming(ctx context.Context, mt v1.TimeInterval, orgID int64) (v1.TimeInterval, error) {
	if err := mt.Validate(); err != nil {
		return v1.TimeInterval{}, MakeErrTimeIntervalInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TimeInterval{}, err
	}

	if err := svc.assignTimeIntervalProvenance(ctx, orgID, revision); err != nil {
		return v1.TimeInterval{}, err
	}

	var found bool
	var existing v1.TimeInterval
	if mt.UID != "" {
		existing, found = svc.getMuteTimingByUID(revision, mt.UID)
	} else {
		// This case supports the legacy provisioning API when a request is made with only a Title and no UID.
		existing, found = revision.GetTimeIntervalWithTitle(mt.Title)
	}
	if !found {
		return v1.TimeInterval{}, ErrTimeIntervalNotFound.Errorf("")
	}

	if existing.Title != mt.Title { // if mute timing is renamed, check if this name is already taken
		if _, ok := revision.GetTimeIntervalWithTitle(mt.Title); ok {
			return v1.TimeInterval{}, ErrTimeIntervalExists.Errorf("")
		}
	}

	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return v1.TimeInterval{}, makeErrMuteTimeIntervalOrigin(existing, "update")
	}

	// check that provenance is not changed in an invalid way
	if err := svc.validator(ctx, existing.Provenance, mt.Provenance); err != nil {
		return v1.TimeInterval{}, err
	}

	// check optimistic concurrency
	if err = svc.checkOptimisticConcurrency(existing, mt.Provenance, mt.Version, "update"); err != nil {
		return v1.TimeInterval{}, err
	}

	updated := revision.SetTimeInterval(mt)

	// TODO add diff and noop detection
	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		// if the name of the time interval changed
		if existing.Title != updated.Title {
			revision.DeleteTimeInterval(existing.UID)

			err = svc.renameTimeIntervalInDependentResources(ctx, orgID, revision, existing.Title, updated.Title, updated.Provenance)
			if err != nil {
				return err
			}

			err = svc.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
			if err != nil {
				return err
			}
		}
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &updated, orgID, updated.Provenance)
	})
	if err != nil {
		return v1.TimeInterval{}, err
	}

	return updated, nil
}

// DeleteMuteTiming deletes the mute timing with the given name in the given org. If the mute timing does not exist, no error is returned.
func (svc *MuteTimingService) DeleteMuteTiming(ctx context.Context, nameOrUID string, orgID int64, provenance models.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if err := svc.assignTimeIntervalProvenance(ctx, orgID, revision); err != nil {
		return err
	}

	// First attempt to find by Name and then by UID.
	existing, found := revision.GetTimeIntervalWithTitle(nameOrUID)
	if !found {
		existing, found = svc.getMuteTimingByUID(revision, v1.ResourceUID(nameOrUID))
		if !found {
			return nil
		}
	}

	// Block deletes of imported intervals
	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return makeErrMuteTimeIntervalOrigin(existing, "delete")
	}

	if err := svc.validator(ctx, existing.Provenance, provenance); err != nil {
		return err
	}

	if revision.TimeIntervalUsedByRoutes(existing.Title) {
		ns, _ := svc.ruleNotificationsStore.ListContactPointRoutings(ctx, models.ListContactPointRoutingsQuery{OrgID: orgID, TimeIntervalName: existing.Title})
		// ignore error here because it's not important
		return MakeErrTimeIntervalInUse(existing.Title, true, slices.Collect(maps.Keys(ns)))
	}

	if err = svc.checkOptimisticConcurrency(existing, provenance, version, "delete"); err != nil {
		return err
	}
	revision.DeleteTimeInterval(existing.UID)

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		keys, err := svc.ruleNotificationsStore.ListContactPointRoutings(ctx, models.ListContactPointRoutingsQuery{OrgID: orgID, TimeIntervalName: existing.Title})
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			return MakeErrTimeIntervalInUse(existing.Title, false, slices.Collect(maps.Keys(keys)))
		}

		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
	})
}

// getMuteTimingByUID returns a mute timing by UID. Return time intervals from both the current and imported config
// if the interval is not found in the current revision.
func (svc *MuteTimingService) getMuteTimingByUID(revision *legacy_storage.ConfigRevision, uid v1.ResourceUID) (v1.TimeInterval, bool) {
	if ti, ok := revision.Config.TimeIntervals[uid]; ok {
		return ti, true
	}

	if importedIntervals := svc.getImportedTimeIntervals(revision); len(importedIntervals) > 0 {
		for _, ti := range importedIntervals {
			if ti.UID == uid {
				return ti, true
			}
		}
	}

	return v1.TimeInterval{}, false
}

func (svc *MuteTimingService) getImportedTimeIntervals(rev *legacy_storage.ConfigRevision) []v1.TimeInterval {
	if !svc.includeImported {
		return nil
	}

	imported, err := rev.Imported()
	if err != nil {
		svc.log.Warn("failed to get imported config revision for mute time intervals", "error", err)
		return nil
	}

	intervals, err := imported.GetTimeIntervals()
	if err != nil {
		svc.log.Warn("failed to get imported mute time intervals", "error", err)
		return nil
	}

	return intervals
}

func (svc *MuteTimingService) assignTimeIntervalProvenance(ctx context.Context, orgID int64, rev *legacy_storage.ConfigRevision) error {
	if len(rev.Config.TimeIntervals) == 0 {
		return nil
	}

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, (&v1.TimeInterval{}).ResourceType())
	if err != nil {
		return err
	}

	for uid, interval := range rev.Config.TimeIntervals {
		prov, ok := provenances[interval.ResourceID()]
		if !ok {
			prov = models.ProvenanceNone
		}
		interval.Provenance = prov
		rev.Config.TimeIntervals[uid] = interval
	}
	return nil
}

func (svc *MuteTimingService) checkOptimisticConcurrency(current v1.TimeInterval, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			svc.log.Debug("ignoring optimistic concurrency check because version was not provided", "timeInterval", current.Title, "operation", action)
		}
		return nil
	}
	if current.Version != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of time interval %s does not match current version %s", desiredVersion, current.Title, current.Version)
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
