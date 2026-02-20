package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

type ImportedConfigRevision struct {
	identifier     string
	rev            *ConfigRevision
	opts           definition.MergeOpts
	importedConfig *definition.PostableApiAlertingConfig
}

func (rev *ConfigRevision) Imported() (ImportedConfigRevision, error) {
	result := ImportedConfigRevision{
		rev: rev,
	}
	if len(rev.Config.ExtraConfigs) == 0 {
		return result, nil
	}
	// support only one config for now
	mimirCfg := rev.Config.ExtraConfigs[0]
	result.identifier = mimirCfg.Identifier
	opts := definition.MergeOpts{
		DedupSuffix:     mimirCfg.Identifier,
		SubtreeMatchers: mimirCfg.MergeMatchers,
	}
	if err := opts.Validate(); err != nil {
		return result, fmt.Errorf("invalid merge options: %w", err)
	}

	mcfg, err := mimirCfg.GetAlertmanagerConfig()
	if err != nil {
		return result, fmt.Errorf("failed to get mimir alertmanager config: %w", err)
	}
	result.importedConfig = &mcfg
	result.opts = opts
	return result, nil
}

func (e ImportedConfigRevision) GetReceivers(uids []string) ([]*models.Receiver, error) {
	if e.importedConfig == nil {
		return nil, nil
	}
	original := e.rev.Config.AlertmanagerConfig.GetReceivers()
	merged, _ := definition.MergeReceivers(original, e.importedConfig.GetReceivers(), e.opts.DedupSuffix)

	capacity := len(uids)
	if capacity == 0 {
		capacity = len(e.importedConfig.Receivers)
	}
	result := make([]*models.Receiver, 0, capacity)
	// merged config contains all receivers from both. We only want the ones from the staged config. However, we need to rename them if necessary.
	for _, r := range merged[len(original):] {
		uid := NameToUid(r.Name)
		if len(uids) > 0 && !slices.Contains(uids, uid) {
			continue
		}
		recv, err := PostableApiReceiverToReceiver(r, models.ProvenanceConvertedPrometheus, models.ResourceOriginImported)
		if err != nil {
			return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
		}
		result = append(result, recv)
	}
	return result, nil
}

func (e ImportedConfigRevision) GetMuteTimeIntervals() ([]definitions.AmMuteTimeInterval, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	// Get original imported intervals (before deduplication)
	importedMute := e.importedConfig.GetMuteTimeIntervals()
	importedTime := e.importedConfig.GetTimeIntervals()

	if len(importedMute) == 0 && len(importedTime) == 0 {
		return nil, nil
	}

	// Get Grafana time intervals for merge
	grafanaMute := e.rev.Config.AlertmanagerConfig.MuteTimeIntervals
	grafanaTime := e.rev.Config.AlertmanagerConfig.TimeIntervals

	// Merge to get the renames map (only renamed if name collision occurs)
	_, renames := definition.MergeTimeIntervals(
		grafanaMute,
		grafanaTime,
		importedMute,
		importedTime,
		e.opts.DedupSuffix,
	)

	// Apply renames to imported intervals
	result := make([]definitions.AmMuteTimeInterval, 0, len(importedTime)+len(importedMute))

	pushRenamed := func(mt definitions.AmMuteTimeInterval) {
		if newName, renamed := renames[mt.Name]; renamed {
			mt.Name = newName
		}
		result = append(result, mt)
	}

	for _, ti := range importedTime {
		pushRenamed(definitions.AmMuteTimeInterval(ti))
	}

	for _, mti := range importedMute {
		pushRenamed(mti)
	}

	return result, nil
}

// ReceiverUseByName returns a map of receiver names to the number of times they are used in routes.
func (e ImportedConfigRevision) ReceiverUseByName() map[string]int {
	if e.importedConfig == nil {
		return nil
	}
	m := make(map[string]int)
	receiverUseCounts([]*definitions.Route{e.importedConfig.Route}, m)
	_, renames := definition.MergeReceivers(e.rev.Config.AlertmanagerConfig.GetReceivers(), e.importedConfig.GetReceivers(), e.opts.DedupSuffix)
	for original, renamed := range renames {
		if cnt, ok := m[original]; ok {
			delete(m, original)
			m[renamed] = cnt
		}
	}
	return m
}

func (e ImportedConfigRevision) GetManagedRoute() (*ManagedRoute, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	renamed, err := definition.DeduplicateResources(e.rev.Config.AlertmanagerConfig, *e.importedConfig, e.opts)
	if err != nil {
		return nil, fmt.Errorf("failed to deduplicate imported config resources: %w", err)
	}

	definition.RenameResourceUsagesInRoutes([]*definition.Route{e.importedConfig.Route}, renamed)

	mr := NewManagedRoute(e.identifier, e.importedConfig.Route)
	mr.Provenance = models.ProvenanceConvertedPrometheus
	mr.Origin = models.ResourceOriginImported
	return mr, nil
}

func (e ImportedConfigRevision) GetInhibitRules() (definitions.ManagedInhibitionRules, error) {
	if e.importedConfig == nil {
		return nil, nil
	}

	importedRules := e.importedConfig.InhibitRules
	if len(importedRules) == 0 {
		return nil, nil
	}

	return BuildManagedInhibitionRules(e.identifier, importedRules)
}

func BuildManagedInhibitionRules(identifier string, rules []definitions.InhibitRule) (definitions.ManagedInhibitionRules, error) {
	scopedRules := applyManagedRouteMatcher(identifier, rules)

	res := make(definitions.ManagedInhibitionRules, len(scopedRules))
	for i, rule := range scopedRules {
		namePrefix := fmt.Sprintf("%s-imported-inhibition-rule-", identifier)

		intFmt := "%d"
		if padLength := ualert.UIDMaxLength - len(namePrefix); padLength >= 0 {
			intFmt = fmt.Sprintf("%%0%dd", padLength+1)
		}
		name := fmt.Sprintf(namePrefix+intFmt, i)

		ir, err := InhibitRuleToInhibitionRule(name, rule, definitions.Provenance(models.ProvenanceConvertedPrometheus))
		if err != nil {
			return nil, err
		}
		res[name] = ir
	}

	return res, nil
}

func applyManagedRouteMatcher(identifier string, rules []definitions.InhibitRule) []definitions.InhibitRule {
	result := make([]config.InhibitRule, 0, len(rules))
	matcher := managedRouteMatcher(identifier)

	for _, rule := range rules {
		sm := make(config.Matchers, 0, len(rule.SourceMatchers)+1)
		sm = append(sm, matcher)
		sm = append(sm, rule.SourceMatchers...)

		tm := make(config.Matchers, 0, len(rule.TargetMatchers)+1)
		tm = append(tm, matcher)
		tm = append(tm, rule.TargetMatchers...)

		result = append(result, definitions.InhibitRule{
			SourceMatchers: sm,
			TargetMatchers: tm,
			Equal:          slices.Clone(rule.Equal),
		})
	}

	return result
}
