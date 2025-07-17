package alertrule

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	prom_model "github.com/prometheus/common/model"
)

var (
	invalidRuleError = fmt.Errorf("rule is not a alerting rule")
)

func ConvertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRule, error) {
	if rule.Type() != ngmodels.RuleTypeAlerting {
		return nil, invalidRuleError
	}
	k8sRule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(rule.UID),
			Name:            rule.UID,
			Namespace:       namespaceMapper(orgID),
			ResourceVersion: fmt.Sprint(rule.Version),
			Labels:          make(map[string]string),
		},
		Spec: model.AlertRuleSpec{
			Title:    rule.Title,
			Paused:   util.Pointer(rule.IsPaused),
			Data:     make(map[string]model.AlertRuleQuery),
			Interval: model.AlertRulePromDuration(strconv.FormatInt(rule.IntervalSeconds, 10)),
			Labels:   make(map[string]model.AlertRuleTemplateString),

			For:                         rule.For.String(),
			KeepFiringFor:               rule.KeepFiringFor.String(),
			NoDataState:                 string(rule.NoDataState),
			ExecErrState:                string(rule.ExecErrState),
			MissingSeriesEvalsToResolve: rule.MissingSeriesEvalsToResolve,
			Annotations:                 make(map[string]model.AlertRuleTemplateString),
			PanelID:                     rule.PanelID,
			DashboardUID:                rule.DashboardUID,
		},
	}

	if rule.RuleGroup != "" {
		k8sRule.ObjectMeta.Labels["group"] = rule.RuleGroup
	}

	for k, v := range rule.Annotations {
		k8sRule.Spec.Annotations[k] = model.AlertRuleTemplateString(v)
	}

	for k, v := range rule.Labels {
		k8sRule.Spec.Labels[k] = model.AlertRuleTemplateString(v)
	}

	for _, query := range rule.Data {
		k8sRule.Spec.Data[query.RefID] = model.AlertRuleQuery{
			QueryType: query.QueryType,
			RelativeTimeRange: model.AlertRuleRelativeTimeRange{
				From: model.AlertRulePromDurationWMillis(query.RelativeTimeRange.From.String()),
				To:   model.AlertRulePromDurationWMillis(query.RelativeTimeRange.To.String()),
			},
			Model:  query.Model,
			Source: util.Pointer(rule.Condition == query.RefID),
		}
	}

	for _, setting := range rule.NotificationSettings {
		nfSetting := model.AlertRuleV0alpha1SpecNotificationSettings{
			Receiver: setting.Receiver,
			GroupBy:  setting.GroupBy,
		}
		if setting.GroupWait != nil {
			nfSetting.GroupWait = util.Pointer(setting.GroupWait.String())
		}
		if setting.GroupInterval != nil {
			nfSetting.GroupInterval = util.Pointer(setting.GroupInterval.String())
		}
		if setting.RepeatInterval != nil {
			nfSetting.RepeatInterval = util.Pointer(setting.RepeatInterval.String())
		}
		if setting.MuteTimeIntervals != nil {
			nfSetting.MuteTimeIntervals = make([]model.AlertRuleMuteTimeIntervalRef, 0, len(setting.MuteTimeIntervals))
			for _, m := range setting.MuteTimeIntervals {
				nfSetting.MuteTimeIntervals = append(nfSetting.MuteTimeIntervals, model.AlertRuleMuteTimeIntervalRef(m))
			}
		}
		if setting.ActiveTimeIntervals != nil {
			nfSetting.ActiveTimeIntervals = make([]model.AlertRuleActiveTimeIntervalRef, 0, len(setting.ActiveTimeIntervals))
			for _, a := range setting.ActiveTimeIntervals {
				nfSetting.ActiveTimeIntervals = append(nfSetting.ActiveTimeIntervals, model.AlertRuleActiveTimeIntervalRef(a))
			}
		}
		k8sRule.Spec.NotificationSettings = &nfSetting
	}

	// TODO: figure out how the rule folder is supposed to be mapped on k8s objects
	meta, err := utils.MetaAccessor(k8sRule)
	if err == nil {
		meta.SetFolder(rule.NamespaceUID)
		meta.SetUpdatedBy(string(*rule.UpdatedBy))
		meta.SetUpdatedTimestamp(&rule.Updated)
	}

	// TODO: add the common metadata fields
	k8sRule.SetUpdatedBy(string(*rule.UpdatedBy))
	k8sRule.SetUpdateTimestamp(rule.Updated)
	// FIXME: we don't have a creation timestamp in the domain model, so we can't set it here.
	// We should consider adding it to the domain model. Migration can set it to the Updated timestamp for existing
	// k8sRule.SetCreationTimestamp(rule.)

	return k8sRule, nil
}

func ConvertToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
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
		k8sRule, err := ConvertToK8sResource(orgID, rule, namespaceMapper)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to k8s resource: %w", err)
		}
		k8sRules.Items = append(k8sRules.Items, *k8sRule)
	}
	return k8sRules, nil
}

func ConvertToDomainModel(k8sRule *model.AlertRule) (*ngmodels.AlertRule, error) {
	domainRule := &ngmodels.AlertRule{
		UID:          string(k8sRule.UID),
		Title:        k8sRule.Spec.Title,
		NamespaceUID: k8sRule.Namespace,
		Data:         make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Data)),
		IsPaused:     k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:       make(map[string]string),

		Annotations:          make(map[string]string),
		NotificationSettings: make([]ngmodels.NotificationSettings, 1),
		NoDataState:          ngmodels.NoDataState(k8sRule.Spec.NoDataState),
		ExecErrState:         ngmodels.ExecutionErrorState(k8sRule.Spec.ExecErrState),

		PanelID:      k8sRule.Spec.PanelID,
		DashboardUID: k8sRule.Spec.DashboardUID,
	}

	for k, v := range k8sRule.Spec.Annotations {
		domainRule.Annotations[k] = string(v)
	}

	for k, v := range k8sRule.Spec.Labels {
		domainRule.Labels[k] = string(v)
	}

	if k8sRule.Spec.MissingSeriesEvalsToResolve != nil {
		src := *k8sRule.Spec.MissingSeriesEvalsToResolve
		domainRule.MissingSeriesEvalsToResolve = &src
	}

	pendingPeriod, err := prom_model.ParseDuration(k8sRule.Spec.For)
	if err != nil {
		return nil, fmt.Errorf("failed to parse duration: %w", err)
	}
	domainRule.For = time.Duration(pendingPeriod)

	keepFiringFor, err := prom_model.ParseDuration(string(k8sRule.Spec.KeepFiringFor))
	if err != nil {
		return nil, fmt.Errorf("failed to parse duration: %w", err)
	}
	domainRule.KeepFiringFor = time.Duration(keepFiringFor)

	interval, err := strconv.Atoi(string(k8sRule.Spec.Interval))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	domainRule.IntervalSeconds = int64(interval)

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
			if domainRule.Condition != "" {
				return nil, fmt.Errorf("multiple queries marked as source: %s and %s", domainRule.Condition, refID)
			}
			domainRule.Condition = refID
		}
	}

	sourceSettings := k8sRule.Spec.NotificationSettings
	if sourceSettings != nil {
		settings := ngmodels.NotificationSettings{
			Receiver: sourceSettings.Receiver,
			GroupBy:  sourceSettings.GroupBy,
		}
		if sourceSettings.GroupWait != nil {
			groupWait, err := prom_model.ParseDuration(*sourceSettings.GroupWait)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupWait = &groupWait
		}
		if sourceSettings.GroupInterval != nil {
			groupInterval, err := prom_model.ParseDuration(*sourceSettings.GroupInterval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupInterval = &groupInterval
		}
		if sourceSettings.RepeatInterval != nil {
			repeatInterval, err := prom_model.ParseDuration(*sourceSettings.RepeatInterval)
			if err != nil {
				return nil, fmt.Errorf("failed to parse duration: %w", err)
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
		domainRule.NotificationSettings[0] = settings
	}

	return domainRule, nil
}
