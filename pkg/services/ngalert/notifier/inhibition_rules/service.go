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

	managedRules := rev.Config.InhibitionRules
	importedRules := svc.getImportedInhibitRules(rev)

	if len(managedRules) == 0 && len(importedRules) == 0 {
		return []v1.InhibitionRule{}, nil
	}

	result := make([]v1.InhibitionRule, 0, len(managedRules)+len(importedRules))
	for _, r := range managedRules {
		result = append(result, r)
	}

	for _, r := range importedRules {
		result = append(result, r)
	}

	slices.SortFunc(result, func(a, b v1.InhibitionRule) int {
		return strings.Compare(string(a.UID), string(b.UID))
	})

	return result, nil
}

// GetInhibitionRule returns a single inhibition rule by UID.
// Includes both Grafana-managed and imported rules.
func (svc *Service) GetInhibitionRule(ctx context.Context, uid v1.ResourceUID, orgID int64) (v1.InhibitionRule, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	result, found, err := svc.getInhibitionRuleByUID(ctx, revision, uid)
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

	if revision.HasInhibitionRule(rule.UID) {
		return v1.InhibitionRule{}, models.ErrInhibitionRuleExists.Errorf("")
	}

	if err := svc.validator(ctx, models.ProvenanceNone, rule.Provenance); err != nil {
		return v1.InhibitionRule{}, err
	}

	created := revision.SetInhibitionRule(rule)

	if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
		return v1.InhibitionRule{}, err
	}

	return created, nil
}

func (svc *Service) UpdateInhibitionRule(ctx context.Context, rule v1.InhibitionRule, version string, orgID int64) (v1.InhibitionRule, error) {
	if err := rule.Validate(); err != nil {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	existing, found, err := svc.getInhibitionRuleByUID(ctx, revision, rule.UID)
	if err != nil {
		return v1.InhibitionRule{}, err
	} else if !found {
		return v1.InhibitionRule{}, models.ErrInhibitionRuleNotFound.Errorf("")
	}

	existingProv := existing.Provenance
	if existingProv == models.ProvenanceConvertedPrometheus {
		return v1.InhibitionRule{}, models.MakeErrInhibitionRuleOrigin(string(existing.UID), "update")
	}

	prov := rule.Provenance
	if err := svc.validator(ctx, existingProv, prov); err != nil {
		return v1.InhibitionRule{}, err
	}

	err = svc.checkOptimisticConcurrency(existing, prov, version, "update")
	if err != nil {
		return v1.InhibitionRule{}, err
	}

	updated := revision.SetInhibitionRule(rule)

	if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
		return v1.InhibitionRule{}, err
	}

	return updated, nil
}

// DeleteInhibitionRule deletes an inhibition rule by UID
func (svc *Service) DeleteInhibitionRule(ctx context.Context, uid v1.ResourceUID, orgID int64, provenance models.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, found, err := svc.getInhibitionRuleByUID(ctx, revision, uid)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	existingProv := existing.Provenance
	if existingProv == models.ProvenanceConvertedPrometheus {
		return models.MakeErrInhibitionRuleOrigin(string(existing.UID), "delete")
	}

	if err := svc.validator(ctx, existingProv, provenance); err != nil {
		return err
	}

	err = svc.checkOptimisticConcurrency(existing, provenance, version, "delete")
	if err != nil {
		return err
	}

	revision.DeleteInhibitionRule(existing.UID)
	return svc.configStore.Save(ctx, revision, orgID)
}

// Helper functions

func (svc *Service) getInhibitionRuleByUID(ctx context.Context, rev *legacy_storage.ConfigRevision, uid v1.ResourceUID) (v1.InhibitionRule, bool, error) {
	// Check Grafana-managed rules first
	managedInhibitionRules := rev.Config.InhibitionRules
	if r, ok := managedInhibitionRules[uid]; ok {
		return r, true, nil
	}

	// Check imported rules
	importedRules := svc.getImportedInhibitRules(rev)
	if r, ok := importedRules[uid]; ok {
		return r, true, nil
	}

	return v1.InhibitionRule{}, false, nil
}

func (svc *Service) getImportedInhibitRules(rev *legacy_storage.ConfigRevision) map[v1.ResourceUID]v1.InhibitionRule {
	if !svc.includeImported() {
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
			svc.log.Debug("ignoring optimistic concurrency check because version was not provided", "inhibition_rule", existing.UID, "operation", action)
		}
		return nil
	}
	if currentVersion := v1.InhibitionRuleFingerprint(existing); currentVersion != desiredVersion {
		return provisioning.ErrVersionConflict.Errorf("provided version %q of inhibition rule %q does not match current version %q", desiredVersion, existing.UID, currentVersion)
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

func (svc *Service) includeImported() bool {
	return svc.isFeatureEnabled(featuremgmt.FlagAlertingImportAlertmanagerAPI)
}
