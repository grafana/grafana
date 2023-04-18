package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/pkg/labels"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
)

type PrometheusSrv struct {
	log     log.Logger
	manager state.AlertInstanceManager
	store   RuleStore
	ac      accesscontrol.AccessControl
}

const queryIncludeInternalLabels = "includeInternalLabels"

func (srv PrometheusSrv) RouteGetAlertStatuses(c *contextmodel.ReqContext) response.Response {
	alertResponse := apimodels.AlertResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.AlertDiscovery{
			Alerts: []*apimodels.Alert{},
		},
	}

	var labelOptions []ngmodels.LabelOption
	if !c.QueryBoolWithDefault(queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}

	alertResponse.Data = PrepareAlertStatuses(srv.manager, AlertStatusesOptions{
		OrgID:        c.OrgID,
		LabelOptions: labelOptions,
	})

	return response.JSON(http.StatusOK, alertResponse)
}

type AlertStatusesOptions struct {
	OrgID        int64
	LabelOptions []ngmodels.LabelOption
}

func PrepareAlertStatuses(manager state.AlertInstanceManager, opts AlertStatusesOptions) apimodels.AlertDiscovery {
	data := apimodels.AlertDiscovery{
		Alerts: []*apimodels.Alert{},
	}

	for _, alertState := range manager.GetAll(opts.OrgID) {
		startsAt := alertState.StartsAt
		valString := ""

		if alertState.State == eval.Alerting || alertState.State == eval.Pending {
			valString = formatValues(alertState)
		}

		data.Alerts = append(data.Alerts, &apimodels.Alert{
			Labels:      alertState.GetLabels(opts.LabelOptions...),
			Annotations: alertState.Annotations,

			// TODO: or should we make this two fields? Using one field lets the
			// frontend use the same logic for parsing text on annotations and this.
			State:    state.FormatStateAndReason(alertState.State, alertState.StateReason),
			ActiveAt: &startsAt,
			Value:    valString,
		})
	}

	return data
}

func formatValues(alertState *state.State) string {
	var fv string
	values := alertState.GetLastEvaluationValuesForCondition()

	switch len(values) {
	case 0:
		fv = alertState.LastEvaluationString
	case 1:
		for _, v := range values {
			fv = strconv.FormatFloat(v, 'e', -1, 64)
			break
		}

	default:
		vs := make([]string, 0, len(values))

		for k, v := range values {
			vs = append(vs, fmt.Sprintf("%s: %s", k, strconv.FormatFloat(v, 'e', -1, 64)))
		}

		// Ensure we have a consistent natural ordering after formatting e.g. A0, A1, A10, A11, A3, etc.
		sort.Strings(vs)
		fv = strings.Join(vs, ", ")
	}

	return fv
}

func getPanelIDFromRequest(r *http.Request) (int64, error) {
	if s := strings.TrimSpace(r.URL.Query().Get("panel_id")); s != "" {
		return strconv.ParseInt(s, 10, 64)
	}
	return 0, nil
}

func getMatchersFromRequest(r *http.Request) (labels.Matchers, error) {
	var matchers labels.Matchers
	for _, s := range r.URL.Query()["matcher"] {
		var m labels.Matcher
		if err := json.Unmarshal([]byte(s), &m); err != nil {
			return nil, err
		}
		if len(m.Name) == 0 {
			return nil, errors.New("bad matcher: the name cannot be blank")
		}
		matchers = append(matchers, &m)
	}
	return matchers, nil
}

func getStatesFromRequest(r *http.Request) ([]eval.State, error) {
	var states []eval.State
	for _, s := range r.URL.Query()["state"] {
		s = strings.ToLower(s)
		switch s {
		case "normal", "inactive":
			states = append(states, eval.Normal)
		case "alerting", "firing":
			states = append(states, eval.Alerting)
		case "pending":
			states = append(states, eval.Pending)
		case "nodata":
			states = append(states, eval.NoData)
		// nolint:goconst
		case "error":
			states = append(states, eval.Error)
		default:
			return states, fmt.Errorf("unknown state '%s'", s)
		}
	}
	return states, nil
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *contextmodel.ReqContext) response.Response {
	dashboardUID := c.Query("dashboard_uid")
	panelID, err := getPanelIDFromRequest(c.Req)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "invalid panel_id")
	}
	if dashboardUID == "" && panelID != 0 {
		return ErrResp(http.StatusBadRequest, errors.New("panel_id must be set with dashboard_uid"), "")
	}

	limitGroups := c.QueryInt64WithDefault("limit", -1)
	limitRulesPerGroup := c.QueryInt64WithDefault("limit_rules", -1)
	limitAlertsPerRule := c.QueryInt64WithDefault("limit_alerts", -1)
	matchers, err := getMatchersFromRequest(c.Req)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	withStates, err := getStatesFromRequest(c.Req)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	withStatesFast := make(map[eval.State]struct{})
	for _, state := range withStates {
		withStatesFast[state] = struct{}{}
	}

	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []apimodels.RuleGroup{},
		},
	}

	var labelOptions []ngmodels.LabelOption
	if !c.QueryBoolWithDefault(queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}

	namespaceMap, err := srv.store.GetUserVisibleNamespaces(c.Req.Context(), c.OrgID, c.SignedInUser)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to get namespaces visible to the user")
	}

	if len(namespaceMap) == 0 {
		srv.log.Debug("user does not have access to any namespaces")
		return response.JSON(http.StatusOK, ruleResponse)
	}

	namespaceUIDs := make([]string, len(namespaceMap))
	for k := range namespaceMap {
		namespaceUIDs = append(namespaceUIDs, k)
	}

	alertRuleQuery := ngmodels.ListAlertRulesQuery{
		OrgID:         c.SignedInUser.OrgID,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
	}
	ruleList, err := srv.store.ListAlertRules(c.Req.Context(), &alertRuleQuery)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return response.JSON(http.StatusInternalServerError, ruleResponse)
	}
	hasAccess := func(evaluator accesscontrol.Evaluator) bool {
		return accesscontrol.HasAccess(srv.ac, c)(accesscontrol.ReqViewer, evaluator)
	}

	folderTitles := map[string]string{}
	for namespaceUID, folder := range namespaceMap {
		folderTitles[namespaceUID] = folder.Title
	}

	ruleResponse.Data = PrepareRuleGroupStatuses(srv.log, srv.manager, folderTitles, ruleList, RuleGroupStatusesOptions{
		LimitGroups:        limitGroups,
		LimitRulesPerGroup: limitRulesPerGroup,
		LimitAlertsPerRule: limitAlertsPerRule,
		Matchers:           matchers,
		WithStates:         withStatesFast,
		LabelOptions:       labelOptions,
		AuthorizeRuleGroup: func(rules []*ngmodels.AlertRule) bool {
			return authorizeAccessToRuleGroup(rules, hasAccess)
		},
	})

	return response.JSON(http.StatusOK, ruleResponse)
}

type RuleGroupStatusesOptions struct {
	LimitGroups        int64
	LimitRulesPerGroup int64
	LimitAlertsPerRule int64
	Matchers           labels.Matchers
	WithStates         map[eval.State]struct{}
	LabelOptions       []ngmodels.LabelOption
	AuthorizeRuleGroup func(rules []*ngmodels.AlertRule) bool
}

func PrepareRuleGroupStatuses(log log.Logger, manager state.AlertInstanceManager, namespaceMap map[string]string, ruleList []*ngmodels.AlertRule, opts RuleGroupStatusesOptions) apimodels.RuleDiscovery {
	data := apimodels.RuleDiscovery{
		RuleGroups: []apimodels.RuleGroup{},
	}

	// Group rules together by Namespace and Rule Group. Rules are also grouped by Org ID,
	// but in this API all rules belong to the same organization.
	groupedRules := make(map[ngmodels.AlertRuleGroupKey][]*ngmodels.AlertRule)
	for _, rule := range ruleList {
		groupKey := rule.GetGroupKey()
		ruleGroup := groupedRules[groupKey]
		ruleGroup = append(ruleGroup, rule)
		groupedRules[groupKey] = ruleGroup
	}
	// Sort the rules in each rule group by index. We do this at the end instead of
	// after each append to avoid having to sort each group multiple times.
	for _, groupRules := range groupedRules {
		ngmodels.AlertRulesBy(ngmodels.AlertRulesByIndex).Sort(groupRules)
	}

	rulesTotals := make(map[string]int64, len(groupedRules))
	for groupKey, rules := range groupedRules {
		folderTitle, ok := namespaceMap[groupKey.NamespaceUID]
		if !ok {
			log.Warn("query returned rules that belong to folder the user does not have access to. All rules that belong to that namespace will not be added to the response", "folder_uid", groupKey.NamespaceUID)
			continue
		}
		if !opts.AuthorizeRuleGroup(rules) {
			continue
		}
		ruleGroup, totals := toRuleGroup(log, manager, groupKey, folderTitle, rules, opts)
		ruleGroup.Totals = totals
		for k, v := range totals {
			rulesTotals[k] += v
		}

		if len(opts.WithStates) > 0 {
			// Filtering is weird but firing, pending, and normal filters also need to be
			// applied to the rule. Others such as nodata and error should have no effect.
			// This is to match the current behavior in the UI.
			filteredRules := make([]apimodels.AlertingRule, 0, len(ruleGroup.Rules))
			for _, rule := range ruleGroup.Rules {
				var state *eval.State
				switch rule.State {
				case "normal", "inactive":
					state = util.Pointer(eval.Normal)
				case "alerting", "firing":
					state = util.Pointer(eval.Alerting)
				case "pending":
					state = util.Pointer(eval.Pending)
				}
				if state != nil {
					if _, ok := opts.WithStates[*state]; ok {
						filteredRules = append(filteredRules, rule)
					}
				}
			}
			ruleGroup.Rules = filteredRules
		}

		if opts.LimitRulesPerGroup > -1 && int64(len(ruleGroup.Rules)) > opts.LimitRulesPerGroup {
			ruleGroup.Rules = ruleGroup.Rules[0:opts.LimitRulesPerGroup]
		}

		data.RuleGroups = append(data.RuleGroups, *ruleGroup)
	}

	data.Totals = rulesTotals

	// Sort Rule Groups before checking limits
	apimodels.RuleGroupsBy(apimodels.RuleGroupsByFileAndName).Sort(data.RuleGroups)
	if opts.LimitGroups > -1 && int64(len(data.RuleGroups)) >= opts.LimitGroups {
		data.RuleGroups = data.RuleGroups[0:opts.LimitGroups]
	}

	return data
}

// This is the same as matchers.Matches but avoids the need to create a LabelSet
func matchersMatch(matchers []*labels.Matcher, labels map[string]string) bool {
	for _, m := range matchers {
		if !m.Matches(labels[m.Name]) {
			return false
		}
	}
	return true
}

func toRuleGroup(log log.Logger, manager state.AlertInstanceManager, groupKey ngmodels.AlertRuleGroupKey, folderTitle string, rules []*ngmodels.AlertRule, opts RuleGroupStatusesOptions) (*apimodels.RuleGroup, map[string]int64) {
	newGroup := &apimodels.RuleGroup{
		Name: groupKey.RuleGroup,
		// file is what Prometheus uses for provisioning, we replace it with namespace which is the folder in Grafana.
		File: folderTitle,
	}

	rulesTotals := make(map[string]int64, len(rules))

	ngmodels.RulesGroup(rules).SortByGroupIndex()
	for _, rule := range rules {
		alertingRule := apimodels.AlertingRule{
			State:       "inactive",
			Name:        rule.Title,
			Query:       ruleToQuery(log, rule),
			Duration:    rule.For.Seconds(),
			Annotations: rule.Annotations,
		}

		newRule := apimodels.Rule{
			Name:           rule.Title,
			Labels:         rule.GetLabels(opts.LabelOptions...),
			Health:         "ok",
			Type:           apiv1.RuleTypeAlerting,
			LastEvaluation: time.Time{},
		}

		states := manager.GetStatesForRuleUID(rule.OrgID, rule.UID)
		totals := make(map[string]int64)
		for _, alertState := range states {
			activeAt := alertState.StartsAt
			valString := ""
			if alertState.State == eval.Alerting || alertState.State == eval.Pending {
				valString = formatValues(alertState)
			}
			totals[strings.ToLower(alertState.State.String())] += 1
			// Do not add error twice when execution error state is Error
			if alertState.Error != nil && rule.ExecErrState != ngmodels.ErrorErrState {
				totals["error"] += 1
			}
			alert := apimodels.Alert{
				Labels:      alertState.GetLabels(opts.LabelOptions...),
				Annotations: alertState.Annotations,

				// TODO: or should we make this two fields? Using one field lets the
				// frontend use the same logic for parsing text on annotations and this.
				State:    state.FormatStateAndReason(alertState.State, alertState.StateReason),
				ActiveAt: &activeAt,
				Value:    valString,
			}

			if alertState.LastEvaluationTime.After(newRule.LastEvaluation) {
				newRule.LastEvaluation = alertState.LastEvaluationTime
			}

			newRule.EvaluationTime = alertState.EvaluationDuration.Seconds()

			switch alertState.State {
			case eval.Normal:
			case eval.Pending:
				if alertingRule.State == "inactive" {
					alertingRule.State = "pending"
				}
			case eval.Alerting:
				if alertingRule.ActiveAt == nil || alertingRule.ActiveAt.After(activeAt) {
					alertingRule.ActiveAt = &activeAt
				}
				alertingRule.State = "firing"
			case eval.Error:
				newRule.Health = "error"
			case eval.NoData:
				newRule.Health = "nodata"
			}

			if alertState.Error != nil {
				newRule.LastError = alertState.Error.Error()
				newRule.Health = "error"
			}

			if len(opts.WithStates) > 0 {
				if _, ok := opts.WithStates[alertState.State]; !ok {
					continue
				}
			}

			if !matchersMatch(opts.Matchers, alertState.Labels) {
				continue
			}

			alertingRule.Alerts = append(alertingRule.Alerts, alert)
		}

		if alertingRule.State != "" {
			rulesTotals[alertingRule.State] += 1
		}

		if newRule.Health == "error" || newRule.Health == "nodata" {
			rulesTotals[newRule.Health] += 1
		}

		apimodels.AlertsBy(apimodels.AlertsByImportance).Sort(alertingRule.Alerts)

		if opts.LimitAlertsPerRule > -1 && int64(len(alertingRule.Alerts)) > opts.LimitAlertsPerRule {
			alertingRule.Alerts = alertingRule.Alerts[0:opts.LimitAlertsPerRule]
		}

		alertingRule.Rule = newRule
		alertingRule.Totals = totals
		newGroup.Rules = append(newGroup.Rules, alertingRule)
		newGroup.Interval = float64(rule.IntervalSeconds)
		// TODO yuri. Change that when scheduler will process alerts in groups
		newGroup.EvaluationTime = newRule.EvaluationTime
		newGroup.LastEvaluation = newRule.LastEvaluation
	}

	return newGroup, rulesTotals
}

// ruleToQuery attempts to extract the datasource queries from the alert query model.
// Returns the whole JSON model as a string if it fails to extract a minimum of 1 query.
func ruleToQuery(logger log.Logger, rule *ngmodels.AlertRule) string {
	var queryErr error
	var queries []string

	for _, q := range rule.Data {
		q, err := q.GetQuery()
		if err != nil {
			// If we can't find the query simply omit it, and try the rest.
			// Even single query alerts would have 2 `AlertQuery`, one for the query and one for the condition.
			if errors.Is(err, ngmodels.ErrNoQuery) {
				continue
			}

			// For any other type of error, it is unexpected abort and return the whole JSON.
			logger.Debug("failed to parse a query", "error", err)
			queryErr = err
			break
		}

		queries = append(queries, q)
	}

	// If we were able to extract at least one query without failure use it.
	if queryErr == nil && len(queries) > 0 {
		return strings.Join(queries, " | ")
	}

	return encodedQueriesOrError(rule.Data)
}

// encodedQueriesOrError tries to encode rule query data into JSON if it fails returns the encoding error as a string.
func encodedQueriesOrError(rules []ngmodels.AlertQuery) string {
	encodedQueries, err := json.Marshal(rules)
	if err == nil {
		return string(encodedQueries)
	}

	return err.Error()
}
