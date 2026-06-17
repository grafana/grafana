package alertrule

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/expr"

	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	errInvalidRule = fmt.Errorf("rule is not a alerting rule")
)

func convertToK8sResource(
	orgID int64,
	rule *ngmodels.AlertRule,
	managerProps utils.ManagerProperties,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRule, error) {
	if rule.Type() != ngmodels.RuleTypeAlerting {
		return nil, errInvalidRule
	}
	interval, err := prom_model.ParseDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))
	if err != nil {
		return nil, fmt.Errorf("failed to parse interval: %w", err)
	}
	noDataState, err := ConvertToK8sNoDataState(rule.NoDataState)
	if err != nil {
		return nil, err
	}

	execErrState, err := ConvertToK8sExecErrState(rule.ExecErrState)
	if err != nil {
		return nil, err
	}

	k8sRule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:            rule.UID,
			UID:             types.UID(rule.GUID),
			Namespace:       namespaceMapper(orgID),
			ResourceVersion: fmt.Sprint(rule.Version),
			Labels:          make(map[string]string),
		},
		Spec: model.AlertRuleSpec{
			Title:       rule.Title,
			Expressions: make(model.AlertRuleExpressionMap),
			Trigger: model.AlertRuleIntervalTrigger{
				Interval: model.AlertRulePromDuration(interval.String()),
			},
			Labels:                      make(map[string]model.AlertRuleTemplateString),
			Annotations:                 make(map[string]model.AlertRuleTemplateString),
			NoDataState:                 noDataState,
			ExecErrState:                execErrState,
			MissingSeriesEvalsToResolve: rule.MissingSeriesEvalsToResolve,
		},
	}

	if rule.IsPaused {
		k8sRule.Spec.Paused = new(true)
	}

	if rule.RuleGroup != "" && !ngmodels.IsNoGroupRuleGroup(rule.RuleGroup) {
		k8sRule.Labels[model.GroupLabelKey] = rule.RuleGroup
		k8sRule.Labels[model.GroupIndexLabelKey] = strconv.Itoa(rule.RuleGroupIndex)
	}

	if rule.For != 0 {
		k8sRule.Spec.For = new(rule.For.String())
	}

	if rule.KeepFiringFor != 0 {
		k8sRule.Spec.KeepFiringFor = new(rule.KeepFiringFor.String())
	}

	if rule.PanelID != nil && rule.DashboardUID != nil &&
		*rule.PanelID > 0 && *rule.DashboardUID != "" {
		k8sRule.Spec.PanelRef = &model.AlertRulePanelRef{
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
		k8sRule.Spec.Expressions[query.RefID] = convertToK8sExpression(query, rule)
	}

	if setting := rule.ContactPointRouting(); setting != nil {
		simplifiedRouting := model.AlertRuleSimplifiedRouting{
			Type:     model.AlertRuleNotificationSettingsTypeSimplifiedRouting,
			Receiver: setting.Receiver,
			GroupBy:  setting.GroupBy,
		}
		if setting.GroupWait != nil {
			simplifiedRouting.GroupWait = new(model.AlertRulePromDuration(setting.GroupWait.String()))
		}
		if setting.GroupInterval != nil {
			simplifiedRouting.GroupInterval = new(model.AlertRulePromDuration(setting.GroupInterval.String()))
		}
		if setting.RepeatInterval != nil {
			simplifiedRouting.RepeatInterval = new(model.AlertRulePromDuration(setting.RepeatInterval.String()))
		}
		if setting.MuteTimeIntervals != nil {
			simplifiedRouting.MuteTimeIntervals = make([]model.AlertRuleTimeIntervalRef, 0, len(setting.MuteTimeIntervals))
			for _, m := range setting.MuteTimeIntervals {
				simplifiedRouting.MuteTimeIntervals = append(simplifiedRouting.MuteTimeIntervals, model.AlertRuleTimeIntervalRef(m))
			}
		}
		if setting.ActiveTimeIntervals != nil {
			simplifiedRouting.ActiveTimeIntervals = make([]model.AlertRuleTimeIntervalRef, 0, len(setting.ActiveTimeIntervals))
			for _, a := range setting.ActiveTimeIntervals {
				simplifiedRouting.ActiveTimeIntervals = append(simplifiedRouting.ActiveTimeIntervals, model.AlertRuleTimeIntervalRef(a))
			}
		}
		k8sRule.Spec.NotificationSettings = &model.AlertRuleNotificationSettings{
			SimplifiedRouting: &simplifiedRouting,
		}
	}

	if setting := rule.PolicyRouting(); setting != nil {
		namedRoutingTree := model.AlertRuleNamedRoutingTree{
			Type:        model.AlertRuleNotificationSettingsTypeNamedRoutingTree,
			RoutingTree: setting.Policy,
		}

		k8sRule.Spec.NotificationSettings = &model.AlertRuleNotificationSettings{
			NamedRoutingTree: &namedRoutingTree,
		}
	}

	meta, err := utils.MetaAccessor(k8sRule)
	if err != nil {
		return nil, fmt.Errorf("failed to get metadata: %w", err)
	}
	meta.SetFolder(rule.NamespaceUID)
	// Keep metadata label in sync with folder annotation for downstream consumers
	if rule.NamespaceUID != "" {
		k8sRule.Labels[model.FolderLabelKey] = rule.NamespaceUID
	}
	if rule.UpdatedBy != nil {
		meta.SetUpdatedBy(string(*rule.UpdatedBy))
		k8sRule.SetUpdatedBy(string(*rule.UpdatedBy))
	}
	meta.SetUpdatedTimestamp(&rule.Updated)
	k8sRule.SetUpdateTimestamp(rule.Updated)

	provenance := ngmodels.ManagerPropertiesToProvenance(managerProps)
	if err := k8sRule.SetProvenanceStatus(string(provenance)); err != nil {
		return nil, fmt.Errorf("failed to set provenance status: %w", err)
	}
	if managerProps.Kind != utils.ManagerKindUnknown {
		meta.SetManagerProperties(managerProps)
	}

	// FIXME: we don't have a creation timestamp in the domain model, so we can't set it here.
	// We should consider adding it to the domain model. Migration can set it to the Updated timestamp for existing
	// k8sRule.SetCreationTimestamp(rule.)
	return k8sRule, nil
}

func ConvertToK8sNoDataState(state ngmodels.NoDataState) (model.AlertRuleNoDataState, error) {
	switch state {
	case ngmodels.OK:
		return model.AlertRuleNoDataStateOk, nil
	case ngmodels.NoData:
		return model.AlertRuleNoDataStateNoData, nil
	case ngmodels.KeepLast:
		return model.AlertRuleNoDataStateKeepLast, nil
	case ngmodels.Alerting:
		return model.AlertRuleNoDataStateAlerting, nil
	default:
		return "", fmt.Errorf("invalid NoDataState value")
	}
}

func ConvertToK8sExecErrState(state ngmodels.ExecutionErrorState) (model.AlertRuleExecErrState, error) {
	switch state {
	case ngmodels.AlertingErrState:
		return model.AlertRuleExecErrStateAlerting, nil
	case ngmodels.ErrorErrState:
		return model.AlertRuleExecErrStateError, nil
	case ngmodels.OkErrState:
		return model.AlertRuleExecErrStateOk, nil
	case ngmodels.KeepLastErrState:
		return model.AlertRuleExecErrStateKeepLast, nil
	default:
		return "", fmt.Errorf("invalid ExecErrState value")
	}
}

func convertToK8sExpression(query ngmodels.AlertQuery, rule *ngmodels.AlertRule) model.AlertRuleExpression {
	expression := model.AlertRuleExpression{
		Model: query.Model,
	}
	if query.QueryType != "" {
		expression.QueryType = new(query.QueryType)
	}
	// DatasourceUID is optional and defaults to expr datasource
	if !expr.IsDataSource(query.DatasourceUID) {
		expression.DatasourceUID = new(model.AlertRuleDatasourceUID(query.DatasourceUID))
	}
	if time.Duration(query.RelativeTimeRange.From) > 0 || time.Duration(query.RelativeTimeRange.To) > 0 {
		expression.RelativeTimeRange = &model.AlertRuleRelativeTimeRange{
			From: model.AlertRulePromDurationWMillis(query.RelativeTimeRange.From.String()),
			To:   model.AlertRulePromDurationWMillis(query.RelativeTimeRange.To.String()),
		}
	}
	if rule.Condition == query.RefID {
		expression.Source = new(true)
	}
	return expression
}

func convertToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
	managerPropsMap map[string]utils.ManagerProperties,
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
		managerProps := managerPropsMap[rule.UID]
		k8sRule, err := convertToK8sResource(orgID, rule, managerProps, namespaceMapper)
		if err != nil {
			return nil, fmt.Errorf("failed to convert to k8s resource: %w", err)
		}
		k8sRules.Items = append(k8sRules.Items, *k8sRule)
	}
	return k8sRules, nil
}

// convertVersionToK8sResource converts an AlertRuleVersion into a k8s AlertRule resource.
// The version's revision message is preserved on the message annotation so callers iterating
// history can display per-revision context the same way the unified storage history list does.
func convertVersionToK8sResource(
	orgID int64,
	version *ngmodels.AlertRuleVersion,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRule, error) {
	if version == nil {
		return nil, fmt.Errorf("nil version")
	}
	k8sRule, err := convertToK8sResource(orgID, &version.AlertRule, utils.ManagerProperties{}, namespaceMapper)
	if err != nil {
		return nil, err
	}
	if version.Message != "" {
		meta, err := utils.MetaAccessor(k8sRule)
		if err != nil {
			return nil, fmt.Errorf("failed to get metadata: %w", err)
		}
		meta.SetMessage(version.Message)
	}
	return k8sRule, nil
}

// convertVersionsToK8sResources converts a list of AlertRuleVersion into a k8s AlertRuleList.
// The Version on each rule is reflected via ResourceVersion so paginating clients can identify revisions.
func convertVersionsToK8sResources(
	orgID int64,
	versions []*ngmodels.AlertRuleVersion,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRuleList, error) {
	out := &model.AlertRuleList{Items: make([]model.AlertRule, 0, len(versions))}
	for _, v := range versions {
		k8sRule, err := convertVersionToK8sResource(orgID, v, namespaceMapper)
		if err != nil {
			if errors.Is(err, errInvalidRule) {
				continue
			}
			return nil, fmt.Errorf("failed to convert version to k8s resource: %w", err)
		}
		out.Items = append(out.Items, *k8sRule)
	}
	return out, nil
}

// convertDeletedToK8sResources converts soft-deleted alert rules into a k8s AlertRuleList,
// stamping each item with a deletion timestamp.
func convertDeletedToK8sResources(
	orgID int64,
	rules []*ngmodels.AlertRule,
	namespaceMapper request.NamespaceMapper,
) (*model.AlertRuleList, error) {
	out := &model.AlertRuleList{Items: make([]model.AlertRule, 0, len(rules))}
	for _, rule := range rules {
		// Tombstone rows clear the UID; the converter requires a non-empty Name, so fall back to the GUID.
		copy := *rule
		if copy.UID == "" {
			copy.UID = copy.GUID
		}
		k8sRule, err := convertToK8sResource(orgID, &copy, utils.ManagerProperties{}, namespaceMapper)
		if err != nil {
			if errors.Is(err, errInvalidRule) {
				continue
			}
			return nil, fmt.Errorf("failed to convert deleted rule to k8s resource: %w", err)
		}
		deleted := metav1.NewTime(rule.Updated)
		k8sRule.SetDeletionTimestamp(&deleted)
		out.Items = append(out.Items, *k8sRule)
	}
	return out, nil
}

func convertToDomainModel(orgID int64, k8sRule *model.AlertRule) (*ngmodels.AlertRule, utils.ManagerProperties, error) {
	domainRule, err := convertToBaseDomainModel(orgID, k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, fmt.Errorf("failed to convert to domain model: %w", err)
	}

	// Prefer ManagerProperties when set — they carry more specific manager info
	// (e.g. ManagerKindTerraform) than the coarser provenance annotation.
	meta, err := utils.MetaAccessor(k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, fmt.Errorf("failed to get metadata: %w", err)
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		// Validate consistency: if a provenance annotation is also explicitly set, it must
		// agree with what ManagerPropertiesToProvenance(mp) would derive.
		if sourceProv := k8sRule.GetProvenanceStatus(); sourceProv != "" && sourceProv != string(ngmodels.ProvenanceNone) {
			derivedProv := string(ngmodels.ManagerPropertiesToProvenance(mp))
			if derivedProv != sourceProv {
				return nil, utils.ManagerProperties{},
					fmt.Errorf("manager properties (kind=%s) and provenance annotation (%s) are inconsistent: manager properties imply provenance %q",
						mp.Kind, sourceProv, derivedProv)
			}
		}
		return domainRule, mp, nil
	}

	// Fall back to the provenance annotation for objects that pre-date ManagerProperties.
	sourceProv := k8sRule.GetProvenanceStatus()
	if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
		return nil, utils.ManagerProperties{}, fmt.Errorf("invalid provenance status: %s", sourceProv)
	}
	return domainRule, ngmodels.ProvenanceToManagerProperties(ngmodels.Provenance(sourceProv)), nil
}

func convertToBaseDomainModel(orgID int64, k8sRule *model.AlertRule) (*ngmodels.AlertRule, error) {
	noDataState, err := convertToDomainNoDataState(model.AlertRuleNoDataState(k8sRule.Spec.NoDataStateOrDefault()))
	if err != nil {
		return nil, err
	}

	execErrState, err := convertToDomainExecErrState(model.AlertRuleExecErrState(k8sRule.Spec.ExecErrStateOrDefault()))
	if err != nil {
		return nil, err
	}

	domainRule := &ngmodels.AlertRule{
		OrgID:        orgID,
		UID:          k8sRule.Name,
		Title:        k8sRule.Spec.Title,
		NamespaceUID: k8sRule.Namespace,
		Data:         make([]ngmodels.AlertQuery, 0, len(k8sRule.Spec.Expressions)),
		IsPaused:     k8sRule.Spec.Paused != nil && *k8sRule.Spec.Paused,
		Labels:       make(map[string]string),
		Annotations:  make(map[string]string),
		NoDataState:  noDataState,
		ExecErrState: execErrState,
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

	for refID, expression := range k8sRule.Spec.Expressions {
		domainQuery, err := convertToDomainQuery(expression, refID)
		if err != nil {
			return nil, err
		}
		domainRule.Data = append(domainRule.Data, domainQuery)
		if expression.Source != nil && *expression.Source {
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
		settings, err := ConvertNotificationSettings(sourceSettings)
		if err != nil {
			return nil, err
		}
		domainRule.NotificationSettings = &settings
	}

	return domainRule, nil
}

func convertToDomainNoDataState(state model.AlertRuleNoDataState) (ngmodels.NoDataState, error) {
	switch state {
	case model.AlertRuleNoDataStateOk:
		return ngmodels.OK, nil
	case model.AlertRuleNoDataStateNoData:
		return ngmodels.NoData, nil
	case model.AlertRuleNoDataStateKeepLast:
		return ngmodels.KeepLast, nil
	case model.AlertRuleNoDataStateAlerting:
		return ngmodels.Alerting, nil
	default:
		return "", fmt.Errorf("invalid NoDataState value")
	}
}

func convertToDomainExecErrState(state model.AlertRuleExecErrState) (ngmodels.ExecutionErrorState, error) {
	switch state {
	case model.AlertRuleExecErrStateAlerting:
		return ngmodels.AlertingErrState, nil
	case model.AlertRuleExecErrStateError:
		return ngmodels.ErrorErrState, nil
	case model.AlertRuleExecErrStateOk:
		return ngmodels.OkErrState, nil
	case model.AlertRuleExecErrStateKeepLast:
		return ngmodels.KeepLastErrState, nil
	default:
		return "", fmt.Errorf("invalid ExecErrState value")
	}
}

func ConvertNotificationSettings(sourceSettings *model.AlertRuleNotificationSettings) (ngmodels.NotificationSettings, error) {
	res := ngmodels.NotificationSettings{}

	if sourceSettings.SimplifiedRouting != nil {
		simplifiedRouting := sourceSettings.SimplifiedRouting
		settings := ngmodels.ContactPointRouting{
			Receiver: simplifiedRouting.Receiver,
			GroupBy:  simplifiedRouting.GroupBy,
		}

		if simplifiedRouting.GroupWait != nil {
			groupWait, err := prom_model.ParseDuration(string(*simplifiedRouting.GroupWait))
			if err != nil {
				return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupWait = &groupWait
		}
		if simplifiedRouting.GroupInterval != nil {
			groupInterval, err := prom_model.ParseDuration(string(*simplifiedRouting.GroupInterval))
			if err != nil {
				return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.GroupInterval = &groupInterval
		}
		if simplifiedRouting.RepeatInterval != nil {
			repeatInterval, err := prom_model.ParseDuration(string(*simplifiedRouting.RepeatInterval))
			if err != nil {
				return ngmodels.NotificationSettings{}, fmt.Errorf("failed to parse duration: %w", err)
			}
			settings.RepeatInterval = &repeatInterval
		}
		if simplifiedRouting.MuteTimeIntervals != nil {
			settings.MuteTimeIntervals = make([]string, 0, len(simplifiedRouting.MuteTimeIntervals))
			for _, m := range simplifiedRouting.MuteTimeIntervals {
				muteInterval := string(m)
				settings.MuteTimeIntervals = append(settings.MuteTimeIntervals, muteInterval)
			}
		}
		if simplifiedRouting.ActiveTimeIntervals != nil {
			settings.ActiveTimeIntervals = make([]string, 0, len(simplifiedRouting.ActiveTimeIntervals))
			for _, a := range simplifiedRouting.ActiveTimeIntervals {
				activeTimeInterval := string(a)
				settings.ActiveTimeIntervals = append(settings.ActiveTimeIntervals, activeTimeInterval)
			}
		}

		res.ContactPointRouting = &settings
	}

	if sourceSettings.NamedRoutingTree != nil {
		res.PolicyRouting = &ngmodels.PolicyRouting{
			Policy: sourceSettings.NamedRoutingTree.RoutingTree,
		}
	}

	return res, nil
}

func convertToDomainQuery(expression model.AlertRuleExpression, refID string) (ngmodels.AlertQuery, error) {
	modelJson, err := json.Marshal(expression.Model)
	if err != nil {
		return ngmodels.AlertQuery{}, fmt.Errorf("failed to marshal model: %w", err)
	}
	domainQuery := ngmodels.AlertQuery{
		RefID: refID,
		Model: modelJson,
	}
	if expression.QueryType != nil {
		domainQuery.QueryType = *expression.QueryType
	}
	if expression.DatasourceUID != nil {
		domainQuery.DatasourceUID = string(*expression.DatasourceUID)
	} else {
		domainQuery.DatasourceUID = expr.DatasourceUID
	}
	if expression.RelativeTimeRange != nil {
		from, err := prom_model.ParseDuration(string(expression.RelativeTimeRange.From))
		if err != nil {
			return ngmodels.AlertQuery{}, fmt.Errorf("failed to parse duration: %w", err)
		}
		to, err := prom_model.ParseDuration(string(expression.RelativeTimeRange.To))
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
