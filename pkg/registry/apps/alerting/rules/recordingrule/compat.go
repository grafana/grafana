package recordingrule

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"time"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
	prom_model "github.com/prometheus/common/model"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	errInvalidRule = fmt.Errorf("rule is not a recording rule")
)

func convertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	provenance ngmodels.Provenance,
	namespaceMapper request.NamespaceMapper,
) (*model.RecordingRule, error) {
	if rule.Type() != ngmodels.RuleTypeRecording {
		return nil, errInvalidRule
	}
	interval, err := prom_model.ParseDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	k8sRule := &model.RecordingRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:            rule.UID,
			Namespace:       namespaceMapper(orgID),
			ResourceVersion: fmt.Sprint(rule.Version),
			Labels:          make(map[string]string),
		},
		Spec: model.RecordingRuleSpec{
			Title: rule.Title,
			Data:  make(map[string]model.RecordingRuleQuery),
			Trigger: model.RecordingRuleIntervalTrigger{
				Interval: model.RecordingRulePromDuration(interval.String()),
			},
			Labels:              make(map[string]model.RecordingRuleTemplateString),
			Metric:              rule.Record.Metric,
			TargetDatasourceUID: rule.Record.TargetDatasourceUID,
		},
	}

	if rule.IsPaused {
		k8sRule.Spec.Paused = util.Pointer(true)
	}

	if rule.RuleGroup != "" && !ngmodels.IsNoGroupRuleGroup(rule.RuleGroup) {
		k8sRule.Labels[model.GroupLabelKey] = rule.RuleGroup
		k8sRule.Labels[model.GroupIndexLabelKey] = strconv.Itoa(rule.RuleGroupIndex)
	}

	for k, v := range rule.Labels {
		k8sRule.Spec.Labels[k] = model.RecordingRuleTemplateString(v)
	}

	for _, query := range rule.Data {
		k8sQuery := model.RecordingRuleQuery{
			QueryType:     query.QueryType,
			Model:         query.Model,
			DatasourceUID: model.RecordingRuleDatasourceUID(query.DatasourceUID),
		}
		if time.Duration(query.RelativeTimeRange.From) > 0 || time.Duration(query.RelativeTimeRange.To) > 0 {
			k8sQuery.RelativeTimeRange = &model.RecordingRuleRelativeTimeRange{
				From: model.RecordingRulePromDurationWMillis(query.RelativeTimeRange.From.String()),
				To:   model.RecordingRulePromDurationWMillis(query.RelativeTimeRange.To.String()),
			}
		}
		if rule.Record != nil && rule.Record.From == query.RefID {
			k8sQuery.Source = util.Pointer(true)
		}
		k8sRule.Spec.Data[query.RefID] = k8sQuery
	}

	meta, err := utils.MetaAccessor(k8sRule)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata: %w", err)
	}
	meta.SetFolder(rule.NamespaceUID)
	if rule.UpdatedBy != nil {
		meta.SetUpdatedBy(string(*rule.UpdatedBy))
		k8sRule.SetUpdatedBy(string(*rule.UpdatedBy))
	}
	meta.SetUpdatedTimestamp(&rule.Updated)
	k8sRule.SetUpdateTimestamp(rule.Updated)

	if err := k8sRule.SetProvenanceStatus(string(provenance)); err != nil {
		return nil, fmt.Errorf("failed to set provenance status: %w", err)
	}

	// FIXME: we don't have a creation timestamp in the domain model, so we can't set it here.
	// We should consider adding it to the domain model. Migration can set it to the Updated timestamp for existing
	// k8sRule.SetCreationTimestamp(rule.)

	k8sRule.UID = gapiutil.CalculateClusterWideUID(k8sRule)
	return k8sRule, nil
}

func convertToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
	provenanceMap map[string]ngmodels.Provenance,
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
		provenance := provenanceMap[rule.UID]
		k8sRule, err := convertToK8sResource(orgID, rule, provenance, namespaceMapper)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to k8s resource: %w", err)
		}
		k8sRules.Items = append(k8sRules.Items, *k8sRule)
	}
	return k8sRules, nil
}

func convertToDomainModel(orgID int64, k8sRule *model.RecordingRule) (*ngmodels.AlertRule, ngmodels.Provenance, error) {
	domainRule, err := convertToBaseDomainModel(orgID, k8sRule)
	if err != nil {
		return nil, ngmodels.ProvenanceNone, fmt.Errorf("failed to convert to domain model: %w", err)
	}
	sourceProv := k8sRule.GetProvenanceStatus()
	if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
		return nil, ngmodels.ProvenanceNone, fmt.Errorf("invalid provenance status: %s", sourceProv)
	}
	provenance := ngmodels.Provenance(sourceProv)
	return domainRule, provenance, nil
}

func convertToBaseDomainModel(orgID int64, k8sRule *model.RecordingRule) (*ngmodels.AlertRule, error) {
	domainRule := &ngmodels.AlertRule{
		OrgID:    orgID,
		UID:      k8sRule.Name,
		Title:    k8sRule.Spec.Title,
		Data:     make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Data)),
		IsPaused: k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:   make(map[string]string),

		Record: &ngmodels.Record{
			Metric:              k8sRule.Spec.Metric,
			TargetDatasourceUID: k8sRule.Spec.TargetDatasourceUID,
		},
	}

	if group, ok := k8sRule.Labels[model.GroupLabelKey]; ok {
		domainRule.RuleGroup = group
	}
	if groupIndexStr, ok := k8sRule.Labels[model.GroupIndexLabelKey]; ok {
		groupIndex, err := strconv.Atoi(groupIndexStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse group index: %w", err)
		}
		domainRule.RuleGroupIndex = groupIndex
	}

	meta, err := utils.MetaAccessor(k8sRule)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata: %w", err)
	}

	domainRule.NamespaceUID = meta.GetFolder()

	interval, err := prom_model.ParseDuration(string(k8sRule.Spec.Trigger.Interval))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	domainRule.IntervalSeconds = int64(time.Duration(interval).Seconds())

	for k, v := range k8sRule.Spec.Labels {
		domainRule.Labels[k] = string(v)
	}
	for refID, query := range k8sRule.Spec.Data {
		modelJson, err := json.Marshal(query.Model)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal model: %w", err)
		}
		domainQuery := ngmodels.AlertQuery{
			RefID:         refID,
			QueryType:     query.QueryType,
			DatasourceUID: string(query.DatasourceUID),
			Model:         modelJson,
		}
		if query.RelativeTimeRange != nil {
			from, err := prom_model.ParseDuration(string(query.RelativeTimeRange.From))
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			to, err := prom_model.ParseDuration(string(query.RelativeTimeRange.To))
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			domainQuery.RelativeTimeRange = ngmodels.RelativeTimeRange{
				From: ngmodels.Duration(from),
				To:   ngmodels.Duration(to),
			}
		}

		domainRule.Data = append(domainRule.Data, domainQuery)

		if query.Source != nil && *query.Source {
			if domainRule.Record.From != "" {
				return nil, fmt.Errorf("multiple queries marked as source: %s and %s", domainRule.Record.From, refID)
			}
			domainRule.Record.From = refID
		}
	}
	if domainRule.Record.From == "" {
		return nil, fmt.Errorf("no query marked as source")
	}
	return domainRule, nil
}
