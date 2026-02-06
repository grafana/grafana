package inhibition_rules

import (
	"context"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"slices"
	"strings"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type routeProvenanceStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type provenanceValidator func(from, to models.Provenance) error

type Service struct {
	configStore             alertmanagerConfigStore
	provenanceStore         routeProvenanceStore
	xact                    transactionManager
	log                     log.Logger
	validator               validation.ProvenanceStatusTransitionValidator
	features                featuremgmt.FeatureToggles
	multiplePoliciesEnabled bool
}

func NewService(
	config alertmanagerConfigStore,
	prov routeProvenanceStore,
	xact transactionManager,
	log log.Logger,
	multiplePoliciesEnabled bool,
) *Service {
	return &Service{
		configStore:             config,
		provenanceStore:         prov,
		xact:                    xact,
		log:                     log,
		validator:               validation.ValidateProvenanceRelaxed,
		multiplePoliciesEnabled: multiplePoliciesEnabled,
	}
}

// GetInhibitionRules returns all inhibition rules for the specified org.
// For app-platform API, this includes both Grafana-managed and imported rules.
func (svc *Service) GetInhibitionRules(ctx context.Context, orgID int64) ([]models.InhibitionRule, error) {
	rev, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	inhibitRules := rev.Config.AlertmanagerConfig.InhibitRules
	importedRules := svc.getImportedInhibitRules(rev)

	if len(inhibitRules) == 0 && len(importedRules) == 0 {
		return []models.InhibitionRule{}, nil
	}

	provenances, err := svc.provenanceStore.GetProvenances(ctx, orgID, models.ResourceTypeInhibitionRule)
	if err != nil {
		return nil, err
	}

	result := make([]models.InhibitionRule, 0, len(inhibitRules)+len(importedRules))

	// Add Grafana-managed rules
	for i := range inhibitRules {
		uid := generateInhibitionRuleUID(&inhibitRules[i])
		prov, ok := provenances[uid]
		if !ok {
			prov = models.ProvenanceNone
		}

		result = append(result, newInhibitionRule(&inhibitRules[i], uid, prov))
	}

	// Add imported rules with ProvenanceConvertedPrometheus
	for i := range importedRules {
		uid := generateInhibitionRuleUID(&importedRules[i])
		result = append(result, newInhibitionRule(&importedRules[i], uid, models.ProvenanceConvertedPrometheus))
	}

	return result, nil
}

// GetInhibitionRule returns a single inhibition rule by UID.
// Includes both Grafana-managed and imported rules.
func (svc *Service) GetInhibitionRule(ctx context.Context, uid string, orgID int64) (models.InhibitionRule, error) {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return models.InhibitionRule{}, err
	}

	result, found, err := svc.getInhibitionRuleByUID(ctx, revision, uid, orgID)
	if err != nil {
		return models.InhibitionRule{}, err
	}
	if found {
		return result, nil
	}

	return models.InhibitionRule{}, models.ErrInhibitionRuleNotFound.Errorf("")
}

// CreateInhibitionRule adds a new inhibition rule
func (svc *Service) CreateInhibitionRule(ctx context.Context, rule models.InhibitionRule, orgID int64) (models.InhibitionRule, error) {
	// Validate the rule
	if err := rule.Validate(); err != nil {
		return models.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return models.InhibitionRule{}, err
	}

	uid := generateInhibitionRuleUID(&rule.InhibitRule)
	if svc.grafanaInhibitionRuleExists(revision.Config.AlertmanagerConfig.InhibitRules, generateInhibitionRuleUID(&rule.InhibitRule)) {
		return models.InhibitionRule{}, models.ErrInhibitionRuleExists.Errorf("")
	}

	revision.Config.AlertmanagerConfig.InhibitRules = append(revision.Config.AlertmanagerConfig.InhibitRules, rule.InhibitRule)

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.SetProvenance(ctx, &rule, orgID, rule.Provenance)
	})
	if err != nil {
		return models.InhibitionRule{}, err
	}

	return newInhibitionRule(&rule.InhibitRule, uid, rule.Provenance), nil
}

// UpdateInhibitionRule updates an existing inhibition rule
// Inhibition rules are treated as immutable since they have no stable identifier and updates change
// the content (and thus UID). Therefore, we delete the existing rule and create a new one with the updated content.
func (svc *Service) UpdateInhibitionRule(ctx context.Context, rule models.InhibitionRule, orgID int64) (models.InhibitionRule, error) {
	if err := rule.Validate(); err != nil {
		return models.InhibitionRule{}, models.MakeErrInhibitionRuleInvalid(err)
	}

	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return models.InhibitionRule{}, err
	}

	existing, found, err := svc.getInhibitionRuleByUID(ctx, revision, rule.UID, orgID)
	if err != nil {
		return models.InhibitionRule{}, err
	} else if !found {
		return models.InhibitionRule{}, models.ErrInhibitionRuleNotFound.Errorf("")
	}

	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return models.InhibitionRule{}, models.MakeErrInhibitionRuleOrigin(existing, "update")
	}

	if err := svc.validator(existing.Provenance, rule.Provenance); err != nil {
		return models.InhibitionRule{}, err
	}

	err = svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		// Inhibition rules don't have a stable identifier (UID is content-based so update operations changes the
		// identity). Always treat them as immutable
		deleteInhibitionRule(revision, rule)
		revision.Config.AlertmanagerConfig.InhibitRules = append(revision.Config.AlertmanagerConfig.InhibitRules, rule.InhibitRule)

		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}

		err = svc.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
		if err != nil {
			return err
		}

		return svc.provenanceStore.SetProvenance(ctx, &rule, orgID, rule.Provenance)
	})
	if err != nil {
		return models.InhibitionRule{}, err
	}

	uid := generateInhibitionRuleUID(&rule.InhibitRule)
	return newInhibitionRule(&rule.InhibitRule, uid, rule.Provenance), nil
}

// DeleteInhibitionRule deletes an inhibition rule by UID
func (svc *Service) DeleteInhibitionRule(ctx context.Context, uid string, orgID int64, provenance models.Provenance, version string) error {
	revision, err := svc.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	existing, found, err := svc.getInhibitionRuleByUID(ctx, revision, uid, orgID)
	if err != nil {
		return err
	} else if !found {
		return nil
	}

	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return models.MakeErrInhibitionRuleOrigin(existing, "delete")
	}

	if err := svc.validator(existing.Provenance, provenance); err != nil {
		return err
	}

	deleteInhibitionRule(revision, existing)

	return svc.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := svc.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return svc.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
	})
}

// Helper functions

func (svc *Service) getInhibitionRuleByUID(ctx context.Context, rev *legacy_storage.ConfigRevision, uid string, orgID int64) (models.InhibitionRule, bool, error) {
	// Check Grafana-managed rules first
	grafanaInhibitionRules := rev.Config.AlertmanagerConfig.InhibitRules

	if idx := slices.IndexFunc(grafanaInhibitionRules, inhibitionRuleByUID(uid)); idx != -1 {
		ir := &grafanaInhibitionRules[idx]
		uid := generateInhibitionRuleUID(ir)

		prov, err := svc.provenanceStore.GetProvenance(
			ctx,
			newInhibitionRule(ir, uid, models.ProvenanceNone),
			orgID,
		)
		if err != nil {
			return models.InhibitionRule{}, false, err
		}

		return newInhibitionRule(ir, uid, prov), true, nil
	}

	// Check imported rules
	if importedRules := svc.getImportedInhibitRules(rev); len(importedRules) > 0 {
		if idx := slices.IndexFunc(importedRules, inhibitionRuleByUID(uid)); idx != -1 {
			ir := &importedRules[idx]
			uid := generateInhibitionRuleUID(ir)

			return newInhibitionRule(ir, uid, models.ProvenanceConvertedPrometheus), true, nil
		}
	}

	return models.InhibitionRule{}, false, nil
}

func (svc *Service) grafanaInhibitionRuleExists(inhibitionRules []config.InhibitRule, uid string) bool {
	return slices.IndexFunc(inhibitionRules, inhibitionRuleByUID(uid)) != -1
}

func inhibitionRuleByUID(uid string) func(config.InhibitRule) bool {
	return func(ir config.InhibitRule) bool {
		return generateInhibitionRuleUID(&ir) == uid
	}
}

func (svc *Service) getImportedInhibitRules(rev *legacy_storage.ConfigRevision) []config.InhibitRule {
	imported, err := rev.Imported()
	if err != nil {
		svc.log.Warn("failed to get imported config revision for inhibition rules", "error", err)
		return nil
	}

	inhibitRules, err := imported.GetInhibitRules(svc.multiplePoliciesEnabled)
	if err != nil {
		svc.log.Warn("failed to get imported inhibition rules", "error", err)
		return nil
	}

	return inhibitRules
}

func deleteInhibitionRule(rev *legacy_storage.ConfigRevision, rule models.InhibitionRule) {
	rev.Config.AlertmanagerConfig.InhibitRules = slices.DeleteFunc(rev.Config.AlertmanagerConfig.InhibitRules, func(ir config.InhibitRule) bool {
		uid := generateInhibitionRuleUID(&ir)
		return uid == rule.UID
	})
}

// newInhibitionRule converts a config.InhibitRule to a models.InhibitionRule.
// Both UID and Version are calculated from the rule's content since inhibition rules
// have no stable name identifier
func newInhibitionRule(ir *config.InhibitRule, uid string, prov models.Provenance) models.InhibitionRule {
	return models.InhibitionRule{
		InhibitRule: *ir,
		UID:         uid,
		Version:     uid,
		Provenance:  prov,
		Origin:      models.ResourceOriginGrafana,
	}
}

func prepareMatchers(matchers []*labels.Matcher) []*labels.Matcher {
	res := make([]*labels.Matcher, 0, len(matchers))
	for _, m := range matchers {
		if m != nil {
			res = append(res, m)
		}
	}
	slices.SortFunc(res, func(a, b *labels.Matcher) int {
		if a.Name != b.Name {
			return strings.Compare(a.Name, b.Name)
		}
		return strings.Compare(a.Value, b.Value)
	})
	return res
}

// generateInhibitionRuleUID generates a stable UID for an inhibition rule based on its content
func generateInhibitionRuleUID(rule *config.InhibitRule) string {
	if rule == nil {
		return ""
	}

	sum := fnv.New64()

	// Hash source matchers
	for _, m := range prepareMatchers(rule.SourceMatchers) {
		_, _ = fmt.Fprintf(sum, "%s:%s:%s:", m.Type.String(), m.Name, m.Value)
	}

	// Hash target matchers
	for _, m := range prepareMatchers(rule.TargetMatchers) {
		_, _ = fmt.Fprintf(sum, "%s:%s:%s:", m.Type.String(), m.Name, m.Value)
	}

	// Hash equal labels
	equal := slices.Clone(rule.Equal)
	slices.Sort(equal)
	for _, e := range equal {
		_, _ = sum.Write([]byte(e + ":"))
	}

	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, sum.Sum64())
	return fmt.Sprintf("%x", buf)
}
