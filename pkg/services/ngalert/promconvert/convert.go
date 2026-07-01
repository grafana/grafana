// Package promconvert converts Prometheus/Mimir rule groups (the wire shape the
// convert API accepts) into Grafana alert rule groups. It centralises the
// apimodels→prom mapping, the prom.Config assembly from server settings, and
// the import guardrails so the user-driven convert API and the background
// external ruler sync worker share one conversion path and cannot drift.
package promconvert

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
	"github.com/grafana/grafana/pkg/setting"
)

// ErrRecordingRulesNotEnabled is returned by ConvertRuleGroup when a group
// contains recording rules but the recording rules feature is disabled. Callers
// map it to their own surface (the convert API to an HTTP 400, the sync worker
// to a sync failure).
var ErrRecordingRulesNotEnabled = errors.New("recording rules not enabled")

// Options carries the per-import conversion settings that are not derived from
// the datasource or the server config.
type Options struct {
	PauseRecordingRules bool
	PauseAlertRules     bool
	// KeepOriginalRuleDefinition preserves the source Prometheus rule YAML in
	// rule metadata so the rules can be read back in Prometheus format.
	KeepOriginalRuleDefinition bool
	NotificationSettings       *models.NotificationSettings
	ExtraLabels                map[string]string
	// SourceIdentifier, when set, is stamped onto each converted rule's metadata
	// (PrometheusStyleRule.SourceIdentifier). The external ruler sync worker sets
	// it to the source datasource UID; the convert API leaves it empty.
	SourceIdentifier string
}

// GroupHasRecordingRules reports whether the group contains any recording rules.
func GroupHasRecordingRules(promGroup apimodels.PrometheusRuleGroup) bool {
	for _, rule := range promGroup.Rules {
		if rule.Record != "" {
			return true
		}
	}
	return false
}

// ConvertRuleGroup converts a single Prometheus rule group into a Grafana alert
// rule group for the given org and namespace (folder), using ds as the query
// datasource and tds as the recording-rules target datasource.
//
// It enforces the recording-rules gate (ErrRecordingRulesNotEnabled) so every
// import path applies it consistently.
func ConvertRuleGroup(
	cfg *setting.UnifiedAlertingSettings,
	ds *datasources.DataSource,
	tds *datasources.DataSource,
	orgID int64,
	namespaceUID string,
	promGroup apimodels.PrometheusRuleGroup,
	opts Options,
) (*models.AlertRuleGroup, error) {
	if GroupHasRecordingRules(promGroup) && !cfg.RecordingRules.Enabled {
		return nil, ErrRecordingRulesNotEnabled
	}

	rules := make([]prom.PrometheusRule, len(promGroup.Rules))
	for i, r := range promGroup.Rules {
		rules[i] = prom.PrometheusRule{
			Alert:         r.Alert,
			Expr:          r.Expr,
			For:           r.For,
			KeepFiringFor: r.KeepFiringFor,
			Labels:        r.Labels,
			Annotations:   r.Annotations,
			Record:        r.Record,
		}
	}
	group := prom.PrometheusRuleGroup{
		Name:        promGroup.Name,
		Interval:    promGroup.Interval,
		Rules:       rules,
		QueryOffset: promGroup.QueryOffset,
		Limit:       promGroup.Limit,
		Labels:      promGroup.Labels,
	}

	keepOriginal := opts.KeepOriginalRuleDefinition
	converter, err := prom.NewConverter(prom.Config{
		DatasourceUID:              ds.UID,
		DatasourceType:             ds.Type,
		TargetDatasourceUID:        tds.UID,
		TargetDatasourceType:       tds.Type,
		DefaultInterval:            cfg.DefaultRuleEvaluationInterval,
		RecordingRules:             prom.RulesConfig{IsPaused: opts.PauseRecordingRules},
		AlertRules:                 prom.RulesConfig{IsPaused: opts.PauseAlertRules},
		KeepOriginalRuleDefinition: &keepOriginal,
		EvaluationOffset:           &cfg.PrometheusConversion.RuleQueryOffset,
		NotificationSettings:       opts.NotificationSettings,
		ExtraLabels:                opts.ExtraLabels,
		SourceIdentifier:           opts.SourceIdentifier,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus converter: %w", err)
	}

	grafanaGroup, err := converter.PrometheusRulesToGrafana(orgID, namespaceUID, group)
	if err != nil {
		return nil, fmt.Errorf("failed to convert Prometheus rules to Grafana rules: %w", err)
	}

	return grafanaGroup, nil
}
