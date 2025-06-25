package recordingrule

import (
	"encoding/json"
	"fmt"
	"strconv"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
	prom_model "github.com/prometheus/common/model"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

var (
	invalidRuleError = fmt.Errorf("rule is not a recording rule")
)

func ConvertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
) (*model.RecordingRule, error) {
	if rule.Type() != ngmodels.RuleTypeRecording {
		return nil, invalidRuleError
	}
	k8sRule := &model.RecordingRule{
		ObjectMeta: metav1.ObjectMeta{
			UID:       types.UID(rule.UID),
			Name:      rule.UID,
			Namespace: namespaceMapper(orgID),
			Labels:    make(map[string]string),
		},
		Spec: model.RecordingRuleSpec{
			Title:    rule.Title,
			Paused:   util.Pointer(rule.IsPaused),
			Data:     make(map[string]model.RecordingRuleQuery),
			Interval: model.RecordingRulePromDuration(strconv.FormatInt(rule.IntervalSeconds, 10)),
			Labels:   make(map[string]model.RecordingRuleTemplateString),

			Metric:              rule.Record.Metric,
			TargetDatasourceUID: rule.Record.TargetDatasourceUID,
		},
	}

	if rule.RuleGroup != "" {
		k8sRule.ObjectMeta.Labels["group"] = rule.RuleGroup
	}

	for k, v := range rule.Labels {
		k8sRule.Spec.Labels[k] = model.RecordingRuleTemplateString(v)
	}

	for _, query := range rule.Data {
		k8sRule.Spec.Data[query.RefID] = model.RecordingRuleQuery{
			QueryType: query.QueryType,
			RelativeTimeRange: model.RecordingRuleRelativeTimeRange{
				From: model.RecordingRulePromDurationWMillis(query.RelativeTimeRange.From.String()),
				To:   model.RecordingRulePromDurationWMillis(query.RelativeTimeRange.To.String()),
			},
			Model:  query.Model,
			Source: util.Pointer(rule.Condition == query.RefID),
		}
	}
	return k8sRule, nil
}

func ConvertToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
	continueToken string,
) (*model.RecordingRuleList, error) {
	k8sRules := &model.RecordingRuleList{
		ListMeta: metav1.ListMeta{
			Continue: continueToken,
		},
		Items: make([]model.RecordingRule, 0, len(rules)),
	}
	for _, rule := range rules {
		k8sRule, err := ConvertToK8sResource(orgID, rule, namespaceMapper)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to k8s resource: %w", err)
		}
		k8sRules.Items = append(k8sRules.Items, *k8sRule)
	}
	return k8sRules, nil
}

func ConvertToDomainModel(k8sRule *model.RecordingRule) (*ngmodels.AlertRule, error) {
	domainRule := &ngmodels.AlertRule{
		UID:          string(k8sRule.UID),
		Title:        k8sRule.Spec.Title,
		NamespaceUID: k8sRule.Namespace,
		Data:         make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Data)),
		IsPaused:     k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:       make(map[string]string),

		Record: &ngmodels.Record{
			Metric:              k8sRule.Spec.Metric,
			TargetDatasourceUID: k8sRule.Spec.TargetDatasourceUID,
		},
	}

	for k, v := range k8sRule.Spec.Labels {
		domainRule.Labels[k] = string(v)
	}

	for refID, query := range k8sRule.Spec.Data {
		from, err := prom_model.ParseDuration(string(query.RelativeTimeRange.From))
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		to, err := prom_model.ParseDuration(string(query.RelativeTimeRange.To))
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		modelJson, err := json.Marshal(query.Model)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal model: %w", err)
		}

		domainRule.Data = append(domainRule.Data, ngmodels.AlertQuery{
			RefID:     refID,
			QueryType: query.QueryType,
			RelativeTimeRange: ngmodels.RelativeTimeRange{
				From: ngmodels.Duration(from),
				To:   ngmodels.Duration(to),
			},
			DatasourceUID: string(query.DatasourceUID),
			Model:         modelJson,
		})

		if query.Source != nil && *query.Source {
			domainRule.Condition = refID
		}
	}
	return domainRule, nil
}
