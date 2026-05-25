package inhibition_rules

import (
	"context"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type Service struct {
	configStore    alertmanagerConfigStore
	log            log.Logger
	validator      validation.ProvenanceStatusTransitionValidator
	featureToggles featuremgmt.FeatureToggles
}

func NewService(
	config alertmanagerConfigStore,
	log log.Logger,
	featureToggles featuremgmt.FeatureToggles,
	validator validation.ProvenanceStatusTransitionValidator,
) *Service {
	return &Service{
		configStore:    config,
		log:            log,
		validator:      validator,
		featureToggles: featureToggles,
	}
}

// GetInhibitionRules returns all inhibition rules for the specified org.
func (svc *Service) GetInhibitionRules(ctx context.Context, orgID int64) ([]v1.InhibitionRule, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	managedRules := rev.Config.ManagedInhibitionRules
	importedRules := svc.getImportedInhibitRules(rev)

	if len(managedRules) == 0 && len(importedRules) == 0 {
		return []v1.InhibitionRule{}, nil
	}

	result := make([]v1.InhibitionRule, 0, len(managedRules)+len(importedRules))
	for _, r := range managedRules {
		result = append(result, *r)
	}

	for _, r := range importedRules {
		result = append(result, *r)
	}

	slices.SortFunc(result, func(a, b v1.InhibitionRule) int {
		return strings.Compare(a.Name, b.Name)
	})

	return result, nil
}

// GetInhibitionRule returns a single inhibition rule by UID.
// Includes both Grafana-managed and imported rules.
func (svc *Service) GetInhibitionRule(ctx context.Context, name string, orgID int64) (v1.InhibitionRule, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	result, found, err := svc.getInhibitionRuleByName(ctx, revision, name)
	if err != nil {
		return v1.InhibitionRule{}, err
	} else if !found {
		return v1.InhibitionRule{}, models.ErrInhibitionRuleNotFound.Errorf("")
	}

	return result, nil
}

// CreateInhibitionRule adds a new inhibition rule
func (svc *Service) CreateInhibitionRule(ctx context.Context, rule v1.InhibitionRule, orgID int64) (v1.InhibitionRule, error) {
	// Validate the rule
	if err := rule.Validate(); err != nil {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	if revision.Config.ManagedInhibitionRules == nil {
		revision.Config.ManagedInhibitionRules = v1.ManagedInhibitionRules{}
	}

	if _, ok := revision.Config.ManagedInhibitionRules[rule.Name]; ok {
		return v1.InhibitionRule{}, models.ErrInhibitionRuleExists.Errorf("")
	}

	if err := svc.validator(ctx, models.ProvenanceNone, models.Provenance(rule.Provenance)); err != nil {
		return v1.InhibitionRule{}, err
	}

	created, err := v1.InhibitRuleToInhibitionRule(rule.Name, rule.InhibitRule, rule.Provenance)
	if err != nil {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision.Config.ManagedInhibitionRules[created.Name] = created

	if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
		return v1.InhibitionRule{}, err
	}

	return *created, nil
}

func (svc *Service) UpdateInhibitionRule(ctx context.Context, name string, rule v1.InhibitionRule, version string, orgID int64) (v1.InhibitionRule, error) {
	if err := rule.Validate(); err != nil {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	existing, found, err := svc.getInhibitionRuleByName(ctx, revision, name)
	if err != nil {
		return v1.InhibitionRule{}, err
	} else if !found {
		return v1.InhibitionRule{}, models.ErrInhibitionRuleNotFound.Errorf("")
	}

	existingProv := models.Provenance(existing.Provenance)
	if existingProv == models.ProvenanceConvertedPrometheus {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleOrigin(existing.Name, "update")
	}

	prov := models.Provenance(rule.Provenance)
	if err := svc.validator(ctx, existingProv, prov); err != nil {
		return v1.InhibitionRule{}, err
	}

	var renamed bool
	if existing.Name != rule.Name {
		// check if new name already exists
		if _, ok := revision.Config.ManagedInhibitionRules[rule.Name]; ok {
			return v1.InhibitionRule{}, models.ErrInhibitionRuleExists.Errorf("")
		}
		renamed = true
	}

	err = svc.checkOptimisticConcurrency(existing, prov, version, "update")
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	if renamed {
		delete(revision.Config.ManagedInhibitionRules, existing.Name)
	}

	updated, err := v1.InhibitRuleToInhibitionRule(rule.Name, rule.InhibitRule, rule.Provenance)
	if err != nil {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision.Config.ManagedInhibitionRules[updated.Name] = updated

	if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
		return v1.InhibitionRule{}, err
	}

	return *updated, nil
}

// DeleteInhibitionRule deletes an inhibition rule by UID
func (svc *Service) DeleteInhibitionRule(ctx context.Context, name string, orgID int64, provenance models.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, found, err := svc.getInhibitionRuleByName(ctx, revision, name)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	existingProv := models.Provenance(existing.Provenance)
	if existingProv == models.ProvenanceConvertedPrometheus {
		return models.MakeErrInhibitionRuleOrigin(existing.Name, "delete")
	}

	if err := svc.validator(ctx, existingProv, provenance); err != nil {
		return err
	}

	err = svc.checkOptimisticConcurrency(existing, provenance, version, "delete")
	if err != nil {
		return err
	}

	delete(revision.Config.ManagedInhibitionRules, existing.Name)
	return svc.configStore.Save(ctx, revision, orgID)
}

// Helper functions

func (svc *Service) getInhibitionRuleByName(ctx context.Context, rev *legacy_storage.ConfigRevision, name string) (v1.InhibitionRule, bool, error) {
	// Check Grafana-managed rules first
	managedInhibitionRules := rev.Config.ManagedInhibitionRules
	if r, ok := managedInhibitionRules[name]; ok {
		return *r, true, nil
	}

	// Check imported rules
	importedRules := svc.getImportedInhibitRules(rev)
	if r, ok := importedRules[name]; ok {
		return *r, true, nil
	}

	return v1.InhibitionRule{}, false, nil
}

func (svc *Service) getImportedInhibitRules(rev *legacy_storage.ConfigRevision) v1.ManagedInhibitionRules {
	if !svc.includeImported() || !svc.multiplePoliciesEnabled() {
		return nil
	}

	imported, err := rev.Imported()
	if err != nil {
		svc.log.Warn("failed to get imported config revision for inhibition rules", "error", err)
		return nil
	}

	inhibitRules, err := imported.GetInhibitRules()
	if err != nil {
		svc.log.Warn("failed to get imported inhibition rules", "error", err)
		return nil
	}

	return inhibitRules
}

func (svc *Service) checkOptimisticConcurrency(existing v1.InhibitionRule, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			svc.log.Debug("ignoring optimistic concurrency check because version was not provided", "inhibition_rule", existing.Name, "operation", action)
		}
		return nil
	}
	if currentVersion := existing.Fingerprint(); currentVersion != desiredVersion {
		return provisioning.ErrVersionConflict.Errorf("provided version %s of inhibition rule %s does not match current version %s", desiredVersion, existing.Name, currentVersion)
	}
	return nil
}

func (svc *Service) isFeatureEnabled(flag string) bool {
	if svc.featureToggles == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return svc.featureToggles.IsEnabledGlobally(flag)
}

func (svc *Service) multiplePoliciesEnabled() bool {
	return svc.isFeatureEnabled(featuremgmt.FlagAlertingMultiplePolicies)
}

func (svc *Service) includeImported() bool {
	return svc.isFeatureEnabled(featuremgmt.FlagAlertingMultiplePolicies) &&
		svc.isFeatureEnabled(featuremgmt.FlagAlertingImportAlertmanagerAPI)
}
