package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/alertmanager/pkg/labels"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
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
	authz   RuleAccessControlService
}

const queryIncludeInternalLabels = "includeInternalLabels"

func getBoolWithDefault(vals url.Values, field string, d bool) bool {
	f := vals.Get(field)
	if f == "" {
		return d
	}

	v, _ := strconv.ParseBool(f)
	return v
}

func getInt64WithDefault(vals url.Values, field string, d int64) int64 {
	f := vals.Get(field)
	if f == "" {
		return d
	}

	v, err := strconv.ParseInt(f, 10, 64)
	if err != nil {
		return d
	}
	return v
}

func (srv PrometheusSrv) RouteGetAlertStatuses(c *contextmodel.ReqContext) response.Response {
	// As we are using req.Form directly, this triggers a call to ParseForm() if needed.
	c.Query("")

	resp := PrepareAlertStatuses(srv.manager, AlertStatusesOptions{
		OrgID: c.SignedInUser.GetOrgID(),
		Query: c.Req.Form,
	})

	return response.JSON(resp.HTTPStatusCode(), resp)
}

type AlertStatusesOptions struct {
	OrgID int64
	Query url.Values
}

func PrepareAlertStatuses(manager state.AlertInstanceManager, opts AlertStatusesOptions) apimodels.AlertResponse {
	alertResponse := apimodels.AlertResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.AlertDiscovery{
			Alerts: []*apimodels.Alert{},
		},
	}

	var labelOptions []ngmodels.LabelOption
	if !getBoolWithDefault(opts.Query, queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}

	for _, alertState := range manager.GetAll(opts.OrgID) {
		startsAt := alertState.StartsAt
		valString := ""

		if alertState.State == eval.Alerting || alertState.State == eval.Pending {
			valString = formatValues(alertState)
		}

		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      alertState.GetLabels(labelOptions...),
			Annotations: alertState.Annotations,

			// TODO: or should we make this two fields? Using one field lets the
			// frontend use the same logic for parsing text on annotations and this.
			State:    state.FormatStateAndReason(alertState.State, alertState.StateReason),
			ActiveAt: &startsAt,
			Value:    valString,
		})
	}

	return alertResponse
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

func getPanelIDFromQuery(v url.Values) (int64, error) {
	if s := strings.TrimSpace(v.Get("panel_id")); s != "" {
		return strconv.ParseInt(s, 10, 64)
	}
	return 0, nil
}

func getMatchersFromQuery(v url.Values) (labels.Matchers, error) {
	var matchers labels.Matchers
	for _, s := range v["matcher"] {
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

func getStatesFromQuery(v url.Values) ([]eval.State, error) {
	var states []eval.State
	for _, s := range v["state"] {
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

type RuleGroupStatusesOptions struct {
	Ctx                context.Context
	OrgID              int64
	Query              url.Values
	Namespaces         map[string]string
	AuthorizeRuleGroup func(rules []*ngmodels.AlertRule) (bool, error)
}

type ListAlertRulesStore interface {
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *contextmodel.ReqContext) response.Response {
	// As we are using req.Form directly, this triggers a call to ParseForm() if needed.
	c.Query("")

	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []apimodels.RuleGroup{},
		},
	}

	namespaceMap, err := srv.store.GetUserVisibleNamespaces(c.Req.Context(), c.SignedInUser.GetOrgID(), c.SignedInUser)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failed to get namespaces visible to the user: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
	}

	namespaces := map[string]string{}
	for namespaceUID, folder := range namespaceMap {
		namespaces[namespaceUID] = folder.Fullpath
	}

	ruleResponse = PrepareRuleGroupStatuses(srv.log, srv.manager, srv.store, RuleGroupStatusesOptions{
		Ctx:        c.Req.Context(),
		OrgID:      c.OrgID,
		Query:      c.Req.Form,
		Namespaces: namespaces,
		AuthorizeRuleGroup: func(rules []*ngmodels.AlertRule) (bool, error) {
			return srv.authz.HasAccessToRuleGroup(c.Req.Context(), c.SignedInUser, rules)
		},
	})

	return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
}

// TODO: Refactor this function to reduce the cylomatic complexity
//
//nolint:gocyclo
func PrepareRuleGroupStatuses(log log.Logger, manager state.AlertInstanceManager, store ListAlertRulesStore, opts RuleGroupStatusesOptions) apimodels.RuleResponse {
	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []apimodels.RuleGroup{},
		},
	}

	dashboardUID := opts.Query.Get("dashboard_uid")
	panelID, err := getPanelIDFromQuery(opts.Query)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("invalid panel_id: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	if dashboardUID == "" && panelID != 0 {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = "panel_id must be set with dashboard_uid"
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}

	limitGroups := getInt64WithDefault(opts.Query, "limit", -1)
	limitRulesPerGroup := getInt64WithDefault(opts.Query, "limit_rules", -1)
	limitAlertsPerRule := getInt64WithDefault(opts.Query, "limit_alerts", -1)
	matchers, err := getMatchersFromQuery(opts.Query)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = err.Error()
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	withStates, err := getStatesFromQuery(opts.Query)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = err.Error()
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	withStatesFast := make(map[eval.State]struct{})
	for _, state := range withStates {
		withStatesFast[state] = struct{}{}
	}

	var labelOptions []ngmodels.LabelOption
	if !getBoolWithDefault(opts.Query, queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}

	if len(opts.Namespaces) == 0 {
		log.Debug("User does not have access to any namespaces")
		return ruleResponse
	}

	namespaceUIDs := make([]string, 0, len(opts.Namespaces))

	folderUID := opts.Query.Get("folder_uid")
	_, exists := opts.Namespaces[folderUID]
	if folderUID != "" && exists {
		namespaceUIDs = append(namespaceUIDs, folderUID)
	} else {
		for k := range opts.Namespaces {
			namespaceUIDs = append(namespaceUIDs, k)
		}
	}

	ruleGroups := opts.Query["rule_group"]

	alertRuleQuery := ngmodels.ListAlertRulesQuery{
		OrgID:         opts.OrgID,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
		RuleGroups:    ruleGroups,
	}
	ruleList, err := store.ListAlertRules(opts.Ctx, &alertRuleQuery)
	if err != nil {
		ruleResponse.DiscoveryBase.Status = "error"
		ruleResponse.DiscoveryBase.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
		return ruleResponse
	}

	ruleNames := opts.Query["rule_name"]
	ruleNamesSet := make(map[string]struct{}, len(ruleNames))
	for _, rn := range ruleNames {
		ruleNamesSet[rn] = struct{}{}
	}

	// Group rules together by Namespace and Rule Group. Rules are also grouped by Org ID,
	// but in this API all rules belong to the same organization. Also filter by rule name if
	// it was provided as a query param.
	groupedRules := make(map[ngmodels.AlertRuleGroupKey][]*ngmodels.AlertRule)
	for _, rule := range ruleList {
		if len(ruleNamesSet) > 0 {
			if _, exists := ruleNamesSet[rule.Title]; !exists {
				continue
			}
		}

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
		folder, ok := opts.Namespaces[groupKey.NamespaceUID]
		if !ok {
			log.Warn("Query returned rules that belong to folder the user does not have access to. All rules that belong to that namespace will not be added to the response", "folder_uid", groupKey.NamespaceUID)
			continue
		}
		ok, err := opts.AuthorizeRuleGroup(rules)
		if err != nil {
			ruleResponse.DiscoveryBase.Status = "error"
			ruleResponse.DiscoveryBase.Error = fmt.Sprintf("cannot authorize access to rule group: %s", err.Error())
			ruleResponse.DiscoveryBase.ErrorType = apiv1.ErrServer
			return ruleResponse
		}
		if !ok {
			continue
		}

		ruleGroup, totals := toRuleGroup(log, manager, groupKey, folder, rules, limitAlertsPerRule, withStatesFast, matchers, labelOptions)
		ruleGroup.Totals = totals
		for k, v := range totals {
			rulesTotals[k] += v
		}

		if len(withStates) > 0 {
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
					if _, ok := withStatesFast[*state]; ok {
						filteredRules = append(filteredRules, rule)
					}
				}
			}
			ruleGroup.Rules = filteredRules
		}

		if limitRulesPerGroup > -1 && int64(len(ruleGroup.Rules)) > limitRulesPerGroup {
			ruleGroup.Rules = ruleGroup.Rules[0:limitRulesPerGroup]
		}

		ruleResponse.Data.RuleGroups = append(ruleResponse.Data.RuleGroups, *ruleGroup)
	}

	ruleResponse.Data.Totals = rulesTotals

	// Sort Rule Groups before checking limits
	apimodels.RuleGroupsBy(apimodels.RuleGroupsByFileAndName).Sort(ruleResponse.Data.RuleGroups)
	if limitGroups > -1 && int64(len(ruleResponse.Data.RuleGroups)) >= limitGroups {
		ruleResponse.Data.RuleGroups = ruleResponse.Data.RuleGroups[0:limitGroups]
	}

	return ruleResponse
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

func toRuleGroup(log log.Logger, manager state.AlertInstanceManager, groupKey ngmodels.AlertRuleGroupKey, folderFullPath string, rules []*ngmodels.AlertRule, limitAlerts int64, withStates map[eval.State]struct{}, matchers labels.Matchers, labelOptions []ngmodels.LabelOption) (*apimodels.RuleGroup, map[string]int64) {
	newGroup := &apimodels.RuleGroup{
		Name: groupKey.RuleGroup,
		// file is what Prometheus uses for provisioning, we replace it with namespace which is the folder in Grafana.
		File: folderFullPath,
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
			Labels:         rule.GetLabels(labelOptions...),
			Health:         "ok",
			Type:           rule.Type().String(),
			LastEvaluation: time.Time{},
		}

		states := manager.GetStatesForRuleUID(rule.OrgID, rule.UID)
		totals := make(map[string]int64)
		totalsFiltered := make(map[string]int64)
		for _, alertState := range states {
			activeAt := alertState.StartsAt
			valString := ""
			if alertState.State == eval.Alerting || alertState.State == eval.Pending {
				valString = formatValues(alertState)
			}
			stateKey := strings.ToLower(alertState.State.String())
			totals[stateKey] += 1
			// Do not add error twice when execution error state is Error
			if alertState.Error != nil && rule.ExecErrState != ngmodels.ErrorErrState {
				totals["error"] += 1
			}
			alert := apimodels.Alert{
				Labels:      alertState.GetLabels(labelOptions...),
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

			if len(withStates) > 0 {
				if _, ok := withStates[alertState.State]; !ok {
					continue
				}
			}

			if !matchersMatch(matchers, alertState.Labels) {
				continue
			}

			totalsFiltered[stateKey] += 1
			// Do not add error twice when execution error state is Error
			if alertState.Error != nil && rule.ExecErrState != ngmodels.ErrorErrState {
				totalsFiltered["error"] += 1
			}

			alertingRule.Alerts = append(alertingRule.Alerts, alert)
		}

		if alertingRule.State != "" {
			rulesTotals[alertingRule.State] += 1
		}

		if newRule.Health == "error" || newRule.Health == "nodata" {
			rulesTotals[newRule.Health] += 1
		}

		alertsBy := apimodels.AlertsBy(apimodels.AlertsByImportance)

		if limitAlerts > -1 && int64(len(alertingRule.Alerts)) > limitAlerts {
			alertingRule.Alerts = alertsBy.TopK(alertingRule.Alerts, int(limitAlerts))
		} else {
			// If there is no effective limit, then just sort the alerts.
			// For large numbers of alerts, this can be faster.
			alertsBy.Sort(alertingRule.Alerts)
		}

		alertingRule.Rule = newRule
		alertingRule.Totals = totals
		alertingRule.TotalsFiltered = totalsFiltered
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
			logger.Debug("Failed to parse a query", "error", err)
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
