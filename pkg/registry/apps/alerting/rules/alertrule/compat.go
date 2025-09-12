package alertrule

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	prom_model "github.com/prometheus/common/model"
)

var (
	errInvalidRule = fmt.Errorf("rule is not a alerting rule")
)

func convertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	provenance ngmodels.Provenance,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRule, error) {
	if rule.Type() != ngmodels.RuleTypeAlerting {
		return nil, errInvalidRule
	}
	interval, err := prom_model.ParseDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	k8sRule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:            rule.UID,
			Namespace:       namespaceMapper(orgID),
			ResourceVersion: fmt.Sprint(rule.Version),
			Labels:          make(map[string]string),
		},
		Spec: model.AlertRuleSpec{
			Title: rule.Title,
			Data:  make(map[string]model.AlertRuleQuery),
			Trigger: model.AlertRuleIntervalTrigger{
				Interval: model.AlertRulePromDuration(interval.String()),
			},
			Labels:                      make(map[string]model.AlertRuleTemplateString),
			Annotations:                 make(map[string]model.AlertRuleTemplateString),
			NoDataState:                 string(rule.NoDataState),
			ExecErrState:                string(rule.ExecErrState),
			MissingSeriesEvalsToResolve: rule.MissingSeriesEvalsToResolve,
		},
	}

	if rule.IsPaused {
		k8sRule.Spec.Paused = util.Pointer(true)
	}

	if rule.RuleGroup != "" && !ngmodels.IsNoGroupRuleGroup(rule.RuleGroup) {
		k8sRule.Labels[model.GroupLabelKey] = rule.RuleGroup
		k8sRule.Labels[model.GroupIndexLabelKey] = strconv.Itoa(rule.RuleGroupIndex)
	}

	if rule.For != 0 {
		k8sRule.Spec.For = util.Pointer(rule.For.String())
	}

	if rule.KeepFiringFor != 0 {
		k8sRule.Spec.KeepFiringFor = util.Pointer(rule.KeepFiringFor.String())
	}

	if rule.PanelID != nil && rule.DashboardUID != nil &&
		*rule.PanelID > 0 && *rule.DashboardUID != "" {
		k8sRule.Spec.PanelRef = &model.AlertRuleV0alpha1SpecPanelRef{
			PanelID:      *rule.PanelID,
			DashboardUID: *rule.DashboardUID,
		}
	}

	for k, v := range rule.Annotations {
		k8sRule.Spec.Annotations[k] = model.AlertRuleTemplateString(v)
	}

	for k, v := range rule.Labels {
		k8sRule.Spec.Labels[k] = model.AlertRuleTemplateString(v)
	}

	for _, query := range rule.Data {
		k8sQuery := model.AlertRuleQuery{
			QueryType:     query.QueryType,
			Model:         query.Model,
			DatasourceUID: model.AlertRuleDatasourceUID(query.DatasourceUID),
			Source:        util.Pointer(rule.Condition == query.RefID),
		}
		if time.Duration(query.RelativeTimeRange.From) > 0 || time.Duration(query.RelativeTimeRange.To) > 0 {
			k8sQuery.RelativeTimeRange = &model.AlertRuleRelativeTimeRange{
				From: model.AlertRulePromDurationWMillis(query.RelativeTimeRange.From.String()),
				To:   model.AlertRulePromDurationWMillis(query.RelativeTimeRange.To.String()),
			}
		}
		k8sRule.Spec.Data[query.RefID] = k8sQuery
	}

	for _, setting := range rule.NotificationSettings {
		nfSetting := model.AlertRuleV0alpha1SpecNotificationSettings{
			Receiver: setting.Receiver,
			GroupBy:  setting.GroupBy,
		}
		if setting.GroupWait != nil {
			nfSetting.GroupWait = util.Pointer(model.AlertRulePromDuration(setting.GroupWait.String()))
		}
		if setting.GroupInterval != nil {
			nfSetting.GroupInterval = util.Pointer(model.AlertRulePromDuration(setting.GroupInterval.String()))
		}
		if setting.RepeatInterval != nil {
			nfSetting.RepeatInterval = util.Pointer(model.AlertRulePromDuration(setting.RepeatInterval.String()))
		}
		if setting.MuteTimeIntervals != nil {
			nfSetting.MuteTimeIntervals = make([]model.AlertRuleTimeIntervalRef, 0, len(setting.MuteTimeIntervals))
			for _, m := range setting.MuteTimeIntervals {
				nfSetting.MuteTimeIntervals = append(nfSetting.MuteTimeIntervals, model.AlertRuleTimeIntervalRef(m))
			}
		}
		if setting.ActiveTimeIntervals != nil {
			nfSetting.ActiveTimeIntervals = make([]model.AlertRuleTimeIntervalRef, 0, len(setting.ActiveTimeIntervals))
			for _, a := range setting.ActiveTimeIntervals {
				nfSetting.ActiveTimeIntervals = append(nfSetting.ActiveTimeIntervals, model.AlertRuleTimeIntervalRef(a))
			}
		}
		k8sRule.Spec.NotificationSettings = &nfSetting
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
) (*model.AlertRuleList, error) {
	k8sRules := &model.AlertRuleList{
		ListMeta: metav1.ListMeta{
			Continue: continueToken,
		},
		Items: make([]model.AlertRule, 0, len(rules)),
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

func convertToDomainModel(orgID int64, k8sRule *model.AlertRule) (*ngmodels.AlertRule, ngmodels.Provenance, error) {
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

func convertToBaseDomainModel(orgID int64, k8sRule *model.AlertRule) (*ngmodels.AlertRule, error) {
	domainRule := &ngmodels.AlertRule{
		OrgID:        orgID,
		UID:          k8sRule.Name,
		Title:        k8sRule.Spec.Title,
		NamespaceUID: k8sRule.Namespace,
		Data:         make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Data)),
		IsPaused:     k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:       make(map[string]string),
		Annotations:  make(map[string]string),
		NoDataState:  ngmodels.NoDataState(k8sRule.Spec.NoDataStateOrDefault()),
		ExecErrState: ngmodels.ExecutionErrorState(k8sRule.Spec.ExecErrStateOrDefault()),
	}

	meta, err := utils.MetaAccessor(k8sRule)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata: %w", err)
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

	domainRule.NamespaceUID = meta.GetFolder()

	for k, v := range k8sRule.Spec.Annotations {
		domainRule.Annotations[k] = string(v)
	}

	for k, v := range k8sRule.Spec.Labels {
		domainRule.Labels[k] = string(v)
	}

	if k8sRule.Spec.PanelRef != nil {
		domainRule.PanelID = &k8sRule.Spec.PanelRef.PanelID
		domainRule.DashboardUID = &k8sRule.Spec.PanelRef.DashboardUID
	}

	if k8sRule.Spec.MissingSeriesEvalsToResolve != nil {
		src := *k8sRule.Spec.MissingSeriesEvalsToResolve
		domainRule.MissingSeriesEvalsToResolve = &src
	}

	if k8sRule.Spec.For != nil {
		pendingPeriod, err := prom_model.ParseDuration(*k8sRule.Spec.For)
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		domainRule.For = time.Duration(pendingPeriod)
	}

	if k8sRule.Spec.KeepFiringFor != nil {
		keepFiringFor, err := prom_model.ParseDuration(*k8sRule.Spec.KeepFiringFor)
		if err != nil {
			return nil, fmt.Errorf("failed to parse duration: %w", err)
		}
		domainRule.KeepFiringFor = time.Duration(keepFiringFor)
	}

	interval, err := prom_model.ParseDuration(string(k8sRule.Spec.Trigger.Interval))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	domainRule.IntervalSeconds = int64(time.Duration(interval).Seconds())

	for refID, query := range k8sRule.Spec.Data {
		domainQuery, err := convertToDomainQuery(query, refID)
		if err != nil {
			return nil, err
		}
		domainRule.Data = append(domainRule.Data, domainQuery)
		if query.Source != nil && *query.Source {
			if domainRule.Condition != "" {
				return nil, fmt.Errorf("multiple queries marked as source: %s and %s", domainRule.Condition, refID)
			}
			domainRule.Condition = refID
		}
	}
	if domainRule.Condition == "" {
		return nil, fmt.Errorf("no query marked as source")
	}

	sourceSettings := k8sRule.Spec.NotificationSettings
	if sourceSettings != nil {
		settings, err := convertNotificationSettings(sourceSettings)
		if err != nil {
			return nil, err
		}
		domainRule.NotificationSettings = []ngmodels.NotificationSettings{settings}
	}

	return domainRule, nil
}

func convertNotificationSettings(sourceSettings *model.AlertRuleV0alpha1SpecNotificationSettings) (ngmodels.NotificationSettings, error) {
	settings := ngmodels.NotificationSettings{
		Receiver: sourceSettings.Receiver,
		GroupBy:  sourceSettings.GroupBy,
	}
	if sourceSettings.GroupWait != nil {
		groupWait, err := prom_model.ParseDuration(string(*sourceSettings.GroupWait))
		if err != nil {
			return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		settings.GroupWait = &groupWait
	}
	if sourceSettings.GroupInterval != nil {
		groupInterval, err := prom_model.ParseDuration(string(*sourceSettings.GroupInterval))
		if err != nil {
			return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		settings.GroupInterval = &groupInterval
	}
	if sourceSettings.RepeatInterval != nil {
		repeatInterval, err := prom_model.ParseDuration(string(*sourceSettings.RepeatInterval))
		if err != nil {
			return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		settings.RepeatInterval = &repeatInterval
	}
	if sourceSettings.MuteTimeIntervals != nil {
		settings.MuteTimeIntervals = make([]string, 0, len(sourceSettings.MuteTimeIntervals))
		for _, m := range sourceSettings.MuteTimeIntervals {
			muteInterval := string(m)
			settings.MuteTimeIntervals = append(settings.MuteTimeIntervals, muteInterval)
		}
	}
	if sourceSettings.ActiveTimeIntervals != nil {
		settings.ActiveTimeIntervals = make([]string, 0, len(sourceSettings.ActiveTimeIntervals))
		for _, a := range sourceSettings.ActiveTimeIntervals {
			activeTimeInterval := string(a)
			settings.ActiveTimeIntervals = append(settings.ActiveTimeIntervals, activeTimeInterval)
		}
	}
	return settings, nil
}

func convertToDomainQuery(query model.AlertRuleQuery, refID string) (ngmodels.AlertQuery, error) {
	modelJson, err := json.Marshal(query.Model)
	if err != nil {
		return ngmodels.AlertQuery{}, fmt.Errorf("failed to marshal model: %w", err)
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
			return ngmodels.AlertQuery{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		to, err := prom_model.ParseDuration(string(query.RelativeTimeRange.To))
		if err != nil {
			return ngmodels.AlertQuery{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		domainQuery.RelativeTimeRange = ngmodels.RelativeTimeRange{
			From: ngmodels.Duration(from),
			To:   ngmodels.Duration(to),
		}
	}
	return domainQuery, nil
}
