package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/prometheus/alertmanager/pkg/labels"
	apiv1 "github.com/prometheus/client_golang/api/prometheus/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type RuleStoreReader interface {
	GetUserVisibleNamespaces(context.Context, int64, identity.Requester) (map[string]*folder.Folder, error)
	ListAlertRulesStoreV2
}

type RuleGroupAccessControlService interface {
	HasAccessInFolder(ctx context.Context, user identity.Requester, folder ngmodels.Namespaced) (bool, error)
}

type StatusReader interface {
	Status(key ngmodels.AlertRuleKey) (ngmodels.RuleStatus, bool)
}

type ProvenanceStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]ngmodels.Provenance, error)
}

type PrometheusSrv struct {
	log             log.Logger
	manager         state.AlertInstanceManager
	status          StatusReader
	store           RuleStoreReader
	authz           RuleGroupAccessControlService
	provenanceStore ProvenanceStore
}

// Package-level OpenTelemetry tracer per Grafana instrumentation conventions.
var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/ngalert/api/prometheus")

func NewPrometheusSrv(log log.Logger, manager state.AlertInstanceManager, status StatusReader, store RuleStoreReader, authz RuleGroupAccessControlService, provenanceStore ProvenanceStore) *PrometheusSrv {
	return &PrometheusSrv{
		log,
		manager,
		status,
		store,
		authz,
		provenanceStore,
	}
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
		OrgID: c.GetOrgID(),
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

		if alertState.State == eval.Alerting || alertState.State == eval.Pending || alertState.State == eval.Recovering {
			valString = FormatValues(alertState)
		}

		alertResponse.Data.Alerts = append(alertResponse.Data.Alerts, &apimodels.Alert{
			Labels:      apimodels.LabelsFromMap(alertState.GetLabels(labelOptions...)),
			Annotations: apimodels.LabelsFromMap(alertState.Annotations),

			// TODO: or should we make this two fields? Using one field lets the
			// frontend use the same logic for parsing text on annotations and this.
			State:    state.FormatStateAndReason(alertState.State, alertState.StateReason),
			ActiveAt: &startsAt,
			Value:    valString,
		})
	}

	return alertResponse
}

func FormatValues(alertState *state.State) string {
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

func GetStatesFromQuery(v url.Values) (map[eval.State]struct{}, error) {
	states := make(map[eval.State]struct{})
	for _, s := range v["state"] {
		s = strings.ToLower(s)
		switch s {
		case "normal", "inactive":
			states[eval.Normal] = struct{}{}
		case "alerting", "firing":
			states[eval.Alerting] = struct{}{}
		case "pending":
			states[eval.Pending] = struct{}{}
		case "nodata":
			states[eval.NoData] = struct{}{}
		case "error":
			states[eval.Error] = struct{}{}
		case "recovering":
			states[eval.Recovering] = struct{}{}
		default:
			return states, fmt.Errorf("unknown state '%s'", s)
		}
	}
	return states, nil
}

func MapStateSetToStrings(stateSet map[eval.State]struct{}) []string {
	states := make([]string, 0, len(stateSet))
	for state := range stateSet {
		states = append(states, state.String())
	}
	return states
}

func GetHealthFromQuery(v url.Values) (map[string]struct{}, error) {
	health := make(map[string]struct{})
	for _, s := range v["health"] {
		s = strings.ToLower(s)
		switch s {
		case "ok", "error", "nodata", "unknown":
			health[s] = struct{}{}
		default:
			return nil, fmt.Errorf("unknown health '%s'", s)
		}
	}
	return health, nil
}

type RuleGroupStatusesOptions struct {
	Ctx               context.Context
	OrgID             int64
	Query             url.Values
	AllowedNamespaces map[string]string
}

type ListAlertRulesStore interface {
	ListAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error)
}

type ListAlertRulesStoreV2 interface {
	ListAlertRulesByGroup(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error)
}

func (srv PrometheusSrv) RouteGetRuleStatuses(c *contextmodel.ReqContext) response.Response {
	// As we are using req.Form directly, this triggers a call to ParseForm() if needed.
	c.Query("")

	ctx, span := tracer.Start(c.Req.Context(), "api.prometheus.RouteGetRuleStatuses")
	defer span.End()
	// Propagate the new context so child spans can attach to it.
	c.Req = c.Req.WithContext(ctx)
	orgID := c.GetOrgID()
	span.SetAttributes(attribute.Int64("org_id", orgID))

	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []apimodels.RuleGroup{},
		},
	}

	namespaceMap, err := srv.store.GetUserVisibleNamespaces(c.Req.Context(), orgID, c.SignedInUser)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failed to get namespaces visible to the user: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
	}
	span.AddEvent("User visible namespaces retrieved")

	allowedNamespaces := map[string]string{}
	for namespaceUID, folder := range namespaceMap {
		// only add namespaces that the user has access to rules in
		hasAccess, err := srv.authz.HasAccessInFolder(c.Req.Context(), c.SignedInUser, ngmodels.NewNamespace(folder))
		if err != nil {
			ruleResponse.Status = "error"
			ruleResponse.Error = fmt.Sprintf("failed to get namespaces visible to the user: %s", err.Error())
			ruleResponse.ErrorType = apiv1.ErrServer
			return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
		}
		if hasAccess {
			allowedNamespaces[namespaceUID] = folder.Fullpath
		}
	}
	span.AddEvent("User permissions checked")
	span.SetAttributes(attribute.Int("allowedNamespaces", len(allowedNamespaces)))

	provenanceRecords, err := srv.provenanceStore.GetProvenances(c.Req.Context(), c.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failed to get provenances visible to the user: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
	}

	ruleResponse = PrepareRuleGroupStatusesV2(
		srv.log,
		srv.store,
		RuleGroupStatusesOptions{
			Ctx:               c.Req.Context(),
			OrgID:             orgID,
			Query:             c.Req.Form,
			AllowedNamespaces: allowedNamespaces,
		},
		RuleStatusMutatorGenerator(srv.status),
		RuleAlertStateMutatorGenerator(srv.manager),
		provenanceRecords,
	)

	return response.JSON(ruleResponse.HTTPStatusCode(), ruleResponse)
}

// mutator function used to attach status to the rule
type RuleStatusMutator func(source *ngmodels.AlertRule, toMutate *apimodels.AlertingRule)

// mutator function used to attach alert states to the rule and returns the totals and filtered totals
type RuleAlertStateMutator func(source *ngmodels.AlertRule, toMutate *apimodels.AlertingRule, stateFilterSet map[eval.State]struct{}, matchers labels.Matchers, labelOptions []ngmodels.LabelOption) (total map[string]int64, filteredTotal map[string]int64)

func RuleStatusMutatorGenerator(statusReader StatusReader) RuleStatusMutator {
	return func(source *ngmodels.AlertRule, toMutate *apimodels.AlertingRule) {
		status, ok := statusReader.Status(source.GetKey())
		// Grafana by design return "ok" health and default other fields for unscheduled rules.
		// This differs from Prometheus.
		if !ok {
			status = ngmodels.RuleStatus{
				Health: "ok",
			}
		}
		toMutate.Health = status.Health
		toMutate.LastError = errorOrEmpty(status.LastError)
		toMutate.LastEvaluation = status.EvaluationTimestamp
		toMutate.EvaluationTime = status.EvaluationDuration.Seconds()
	}
}

func RuleAlertStateMutatorGenerator(manager state.AlertInstanceManager) RuleAlertStateMutator {
	return func(source *ngmodels.AlertRule, toMutate *apimodels.AlertingRule, stateFilterSet map[eval.State]struct{}, matchers labels.Matchers, labelOptions []ngmodels.LabelOption) (map[string]int64, map[string]int64) {
		states := manager.GetStatesForRuleUID(source.OrgID, source.UID)
		totals := make(map[string]int64)
		totalsFiltered := make(map[string]int64)
		for _, alertState := range states {
			activeAt := alertState.StartsAt
			valString := ""
			if alertState.State == eval.Alerting || alertState.State == eval.Pending || alertState.State == eval.Recovering {
				valString = FormatValues(alertState)
			}
			stateKey := strings.ToLower(alertState.State.String())
			totals[stateKey] += 1
			// Do not add error twice when execution error state is Error
			if alertState.Error != nil && source.ExecErrState != ngmodels.ErrorErrState {
				totals["error"] += 1
			}
			alert := apimodels.Alert{
				Labels:      apimodels.LabelsFromMap(alertState.GetLabels(labelOptions...)),
				Annotations: apimodels.LabelsFromMap(alertState.Annotations),

				// TODO: or should we make this two fields? Using one field lets the
				// frontend use the same logic for parsing text on annotations and this.
				State:    state.FormatStateAndReason(alertState.State, alertState.StateReason),
				ActiveAt: &activeAt,
				Value:    valString,
			}

			// Set the state of the rule based on the state of its alerts.
			// Only update the rule state with 'pending' or 'recovering' if the current state is 'inactive'.
			// This prevents overwriting a higher-severity 'firing' state in the case of a rule with multiple alerts.
			switch alertState.State {
			case eval.Normal:
			case eval.Pending:
				if toMutate.State == "inactive" {
					toMutate.State = "pending"
				}
			case eval.Recovering:
				if toMutate.State == "inactive" {
					toMutate.State = "recovering"
				}
			case eval.Alerting:
				if toMutate.ActiveAt == nil || toMutate.ActiveAt.After(activeAt) {
					toMutate.ActiveAt = &activeAt
				}
				toMutate.State = "firing"
			case eval.Error:
			case eval.NoData:
			}

			if len(stateFilterSet) > 0 {
				if _, ok := stateFilterSet[alertState.State]; !ok {
					continue
				}
			}

			if !matchersMatch(matchers, alertState.Labels) {
				continue
			}

			totalsFiltered[stateKey] += 1
			// Do not add error twice when execution error state is Error
			if alertState.Error != nil && source.ExecErrState != ngmodels.ErrorErrState {
				totalsFiltered["error"] += 1
			}

			toMutate.Alerts = append(toMutate.Alerts, alert)
		}
		return totals, totalsFiltered
	}
}

// paginationContext holds limits and filters for filter-aware pagination
type paginationContext struct {
	opts              RuleGroupStatusesOptions
	provenanceRecords map[string]ngmodels.Provenance
	ruleStatusMutator RuleStatusMutator
	alertStateMutator RuleAlertStateMutator

	// Query parameters
	namespaceUIDs   []string
	ruleUIDs        []string
	dashboardUID    string
	panelID         int64
	ruleGroups      []string
	receiverName    string
	dataSourceUIDs  []string
	title           string
	searchRuleGroup string
	ruleType        ngmodels.RuleTypeFilter
	ruleNamesSet    map[string]struct{}

	// Filters
	stateFilterSet     map[eval.State]struct{}
	healthFilterSet    map[string]struct{}
	matchers           labels.Matchers
	labelOptions       []ngmodels.LabelOption
	limitAlertsPerRule int64
	limitRulesPerGroup int64
}

// pageResult is the result of fetching and filtering of one page
type pageResult struct {
	groups      []apimodels.RuleGroup
	totalsDelta map[string]int64
	nextToken   string
	hasMore     bool
}

func accumulateTotals(dest, source map[string]int64) {
	for k, v := range source {
		dest[k] += v
	}
}

// fetchAndFilterPage fetches one page from the store and applies filters
func (ctx *paginationContext) fetchAndFilterPage(log log.Logger, store ListAlertRulesStoreV2, span trace.Span, token string, remainingGroups, remainingRules int64) (pageResult, error) {
	byGroupQuery := ngmodels.ListAlertRulesExtendedQuery{
		ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
			OrgID:           ctx.opts.OrgID,
			NamespaceUIDs:   ctx.namespaceUIDs,
			RuleUIDs:        ctx.ruleUIDs,
			DashboardUID:    ctx.dashboardUID,
			PanelID:         ctx.panelID,
			RuleGroups:      ctx.ruleGroups,
			ReceiverName:    ctx.receiverName,
			DataSourceUIDs:  ctx.dataSourceUIDs,
			SearchTitle:     ctx.title,
			SearchRuleGroup: ctx.searchRuleGroup,
		},
		RuleType:      ctx.ruleType,
		Limit:         remainingGroups,
		RuleLimit:     remainingRules,
		ContinueToken: token,
	}

	ruleList, newToken, err := store.ListAlertRulesByGroup(ctx.opts.Ctx, &byGroupQuery)
	if err != nil {
		return pageResult{}, err
	}

	span.SetAttributes(
		attribute.Int("store_rule_list_len", len(ruleList)),
		attribute.Bool("store_continue_token_set", newToken != ""),
	)
	span.AddEvent("Alert rules retrieved from store")

	groupedRules := getGroupedRules(log, ruleList, ctx.ruleNamesSet, ctx.opts.AllowedNamespaces)

	result := pageResult{
		groups:      make([]apimodels.RuleGroup, 0, len(groupedRules)),
		totalsDelta: make(map[string]int64),
		nextToken:   newToken,
		hasMore:     newToken != "",
	}

	for _, rg := range groupedRules {
		ruleGroup, totals := toRuleGroup(
			log, rg.GroupKey, rg.Folder, rg.Rules,
			ctx.provenanceRecords, ctx.limitAlertsPerRule,
			ctx.stateFilterSet, ctx.matchers, ctx.labelOptions,
			ctx.ruleStatusMutator, ctx.alertStateMutator,
		)
		ruleGroup.Totals = totals
		accumulateTotals(result.totalsDelta, totals)

		if len(ctx.stateFilterSet) > 0 {
			filterRulesByState(ruleGroup, ctx.stateFilterSet)
		}

		if len(ctx.healthFilterSet) > 0 {
			filterRulesByHealth(ruleGroup, ctx.healthFilterSet)
		}

		if ctx.limitRulesPerGroup > -1 && int64(len(ruleGroup.Rules)) > ctx.limitRulesPerGroup {
			ruleGroup.Rules = ruleGroup.Rules[0:ctx.limitRulesPerGroup]
		}

		if len(ruleGroup.Rules) > 0 {
			result.groups = append(result.groups, *ruleGroup)
		}
	}

	return result, nil
}

// paginateRuleGroups fetches pages until limits are satisfied applying filters at each step
func paginateRuleGroups(log log.Logger, store ListAlertRulesStoreV2, ctx *paginationContext, span trace.Span, maxGroups, maxRules int64, startToken string) ([]apimodels.RuleGroup, map[string]int64, string, error) {
	allGroups := []apimodels.RuleGroup{}
	rulesTotals := make(map[string]int64)

	continueToken := startToken
	groupsReturned := int64(0)
	rulesReturned := int64(0)

	for {
		remainingGroups := maxGroups
		if maxGroups > 0 {
			remainingGroups = maxGroups - groupsReturned
			if remainingGroups <= 0 {
				break
			}
		}
		remainingRules := maxRules
		if maxRules > 0 {
			remainingRules = maxRules - rulesReturned
			if remainingRules <= 0 {
				break
			}
		}

		page, err := ctx.fetchAndFilterPage(log, store, span, continueToken, remainingGroups, remainingRules)
		if err != nil {
			return nil, nil, "", err
		}

		accumulateTotals(rulesTotals, page.totalsDelta)

		// Add groups and check limits
		for _, group := range page.groups {
			allGroups = append(allGroups, group)
			groupsReturned++
			rulesReturned += int64(len(group.Rules))

			// Check if we've hit limits
			if (maxGroups > 0 && groupsReturned == maxGroups) || (maxRules > 0 && rulesReturned >= maxRules) {
				return allGroups, rulesTotals, page.nextToken, nil
			}
		}

		if !page.hasMore {
			return allGroups, rulesTotals, "", nil
		}

		if page.nextToken == continueToken {
			log.Warn("Pagination loop detected same token, stopping", "token", page.nextToken)
			return allGroups, rulesTotals, page.nextToken, nil
		}

		continueToken = page.nextToken
	}

	return allGroups, rulesTotals, continueToken, nil
}

func PrepareRuleGroupStatusesV2(log log.Logger, store ListAlertRulesStoreV2, opts RuleGroupStatusesOptions, ruleStatusMutator RuleStatusMutator, alertStateMutator RuleAlertStateMutator, provenanceRecords map[string]ngmodels.Provenance) apimodels.RuleResponse {
	ctx, span := tracer.Start(opts.Ctx, "api.prometheus.PrepareRuleGroupStatusesV2")
	defer span.End()
	opts.Ctx = ctx

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
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("invalid panel_id: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	if dashboardUID == "" && panelID != 0 {
		ruleResponse.Status = "error"
		ruleResponse.Error = "panel_id must be set with dashboard_uid"
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	span.SetAttributes(
		attribute.String("dashboard_uid", dashboardUID),
		attribute.Int64("panel_id", panelID),
	)

	limitRulesPerGroup := getInt64WithDefault(opts.Query, "limit_rules", -1)
	limitAlertsPerRule := getInt64WithDefault(opts.Query, "limit_alerts", -1)
	span.SetAttributes(
		attribute.Int64("limit_rules", limitRulesPerGroup),
		attribute.Int64("limit_alerts", limitAlertsPerRule),
	)
	matchers, err := getMatchersFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	span.SetAttributes(attribute.Int("matcher_count", len(matchers)))

	stateFilterSet, err := GetStatesFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	span.SetAttributes(
		attribute.Int("state_filter_count", len(stateFilterSet)),
		attribute.StringSlice("state_filter", MapStateSetToStrings(stateFilterSet)),
	)

	healthFilterSet, err := GetHealthFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	span.SetAttributes(
		attribute.Int("health_filter_count", len(healthFilterSet)),
		attribute.StringSlice("health_filter", slices.Collect(maps.Keys(healthFilterSet))),
	)

	var labelOptions []ngmodels.LabelOption
	if !getBoolWithDefault(opts.Query, queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}
	span.SetAttributes(
		attribute.Bool("include_internal_labels", len(labelOptions) == 0),
	)

	if len(opts.AllowedNamespaces) == 0 {
		log.Debug("User does not have access to any namespaces")
		return ruleResponse
	}

	namespaceUIDs := make([]string, 0, len(opts.AllowedNamespaces))

	folderUID := opts.Query.Get("folder_uid")
	searchFolder := opts.Query.Get("search.folder")

	_, exists := opts.AllowedNamespaces[folderUID]
	if folderUID != "" && exists {
		// Exact folder UID match
		namespaceUIDs = append(namespaceUIDs, folderUID)
	} else if searchFolder != "" {
		// Search folders by full path
		matcher := NewTextMatcher(searchFolder)
		for uid, fullpath := range opts.AllowedNamespaces {
			if matcher.Match(fullpath) {
				namespaceUIDs = append(namespaceUIDs, uid)
			}
		}
	} else {
		for k := range opts.AllowedNamespaces {
			namespaceUIDs = append(namespaceUIDs, k)
		}
	}

	span.SetAttributes(
		attribute.Bool("folder_uid_set", folderUID != ""),
		attribute.Bool("search_folder_set", searchFolder != ""),
		attribute.Int("namespace_count", len(namespaceUIDs)),
	)

	if searchFolder != "" && len(namespaceUIDs) == 0 {
		log.Debug("No folders matched search.folder, returning empty response")
		return ruleResponse
	}

	ruleGroups := opts.Query["rule_group"]
	ruleUIDs := opts.Query["rule_uid"]

	span.SetAttributes(
		attribute.Int("rule_group_count", len(ruleGroups)),
		attribute.Int("rule_uid_count", len(ruleUIDs)),
	)

	receiverName := opts.Query.Get("receiver_name")
	span.SetAttributes(attribute.Bool("receiver_name_set", receiverName != ""))

	title := opts.Query.Get("search.rule_name")
	span.SetAttributes(attribute.Bool("search_rule_name_set", title != ""))

	searchRuleGroup := opts.Query.Get("search.rule_group")
	span.SetAttributes(attribute.Bool("search_rule_group_set", searchRuleGroup != ""))

	dataSourceUIDs := opts.Query["datasource_uid"]
	span.SetAttributes(attribute.Bool("datasource_uid_set", len(dataSourceUIDs) > 0))

	var ruleType ngmodels.RuleTypeFilter
	switch ngmodels.RuleType(opts.Query.Get("rule_type")) {
	case ngmodels.RuleTypeAlerting:
		ruleType = ngmodels.RuleTypeFilterAlerting
		span.SetAttributes(attribute.Bool("alerting_only", true))
	case ngmodels.RuleTypeRecording:
		ruleType = ngmodels.RuleTypeFilterRecording
		span.SetAttributes(attribute.Bool("recording_only", true))
	default:
		ruleType = ngmodels.RuleTypeFilterAll
	}

	// Pagination limits
	//
	// group_limit: Maximum number of rule groups to return
	//   - Returns exactly this many groups or fewer if not enough exist
	//
	// rule_limit: Maximum number of rules to return across all groups
	//   - Returns complete groups until total rules meets or exceeds this limit
	//   - May exceed the rule limit if needed to include the final complete group
	//   - Example: rule_limit=15 with groups of [10, 10, 10] rules returns first 2 groups, 20 rules total
	//
	// When both limits are specified, whichever limit is reached first takes precedence.
	maxGroups := getInt64WithDefault(opts.Query, "group_limit", -1)
	maxRules := getInt64WithDefault(opts.Query, "rule_limit", -1)
	nextToken := opts.Query.Get("group_next_token")
	span.SetAttributes(
		attribute.Int64("group_limit", maxGroups),
		attribute.Int64("rule_limit", maxRules),
		attribute.Bool("group_next_token_set", nextToken != ""),
	)

	if maxGroups == 0 || maxRules == 0 {
		return ruleResponse
	}

	ruleNames := opts.Query["rule_name"]
	ruleNamesSet := make(map[string]struct{}, len(ruleNames))
	for _, rn := range ruleNames {
		ruleNamesSet[rn] = struct{}{}
	}
	span.SetAttributes(attribute.Int("rule_name_count", len(ruleNamesSet)))

	pagCtx := &paginationContext{
		opts:               opts,
		provenanceRecords:  provenanceRecords,
		ruleStatusMutator:  ruleStatusMutator,
		alertStateMutator:  alertStateMutator,
		namespaceUIDs:      namespaceUIDs,
		ruleUIDs:           ruleUIDs,
		dashboardUID:       dashboardUID,
		panelID:            panelID,
		ruleGroups:         ruleGroups,
		receiverName:       receiverName,
		title:              title,
		dataSourceUIDs:     dataSourceUIDs,
		searchRuleGroup:    searchRuleGroup,
		ruleType:           ruleType,
		ruleNamesSet:       ruleNamesSet,
		stateFilterSet:     stateFilterSet,
		healthFilterSet:    healthFilterSet,
		matchers:           matchers,
		labelOptions:       labelOptions,
		limitAlertsPerRule: limitAlertsPerRule,
		limitRulesPerGroup: limitRulesPerGroup,
	}

	groups, rulesTotals, continueToken, err := paginateRuleGroups(log, store, pagCtx, span, maxGroups, maxRules, nextToken)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		return ruleResponse
	}

	ruleResponse.Data.RuleGroups = groups
	ruleResponse.Data.NextToken = continueToken

	// Only return Totals if there is no pagination
	if maxGroups == -1 && maxRules == -1 {
		ruleResponse.Data.Totals = rulesTotals
	}

	return ruleResponse
}

func PrepareRuleGroupStatuses(log log.Logger, store ListAlertRulesStore, opts RuleGroupStatusesOptions, ruleStatusMutator RuleStatusMutator, alertStateMutator RuleAlertStateMutator, provenanceRecords map[string]ngmodels.Provenance) apimodels.RuleResponse {
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
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("invalid panel_id: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	if dashboardUID == "" && panelID != 0 {
		ruleResponse.Status = "error"
		ruleResponse.Error = "panel_id must be set with dashboard_uid"
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}

	limitRulesPerGroup := getInt64WithDefault(opts.Query, "limit_rules", -1)
	limitAlertsPerRule := getInt64WithDefault(opts.Query, "limit_alerts", -1)
	matchers, err := getMatchersFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}
	stateFilterSet, err := GetStatesFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}

	healthFilterSet, err := GetHealthFromQuery(opts.Query)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = err.Error()
		ruleResponse.ErrorType = apiv1.ErrBadData
		return ruleResponse
	}

	var labelOptions []ngmodels.LabelOption
	if !getBoolWithDefault(opts.Query, queryIncludeInternalLabels, false) {
		labelOptions = append(labelOptions, ngmodels.WithoutInternalLabels())
	}

	if len(opts.AllowedNamespaces) == 0 {
		log.Debug("User does not have access to any namespaces")
		return ruleResponse
	}

	namespaceUIDs := make([]string, 0, len(opts.AllowedNamespaces))

	folderUID := opts.Query.Get("folder_uid")
	_, exists := opts.AllowedNamespaces[folderUID]
	if folderUID != "" && exists {
		namespaceUIDs = append(namespaceUIDs, folderUID)
	} else {
		for k := range opts.AllowedNamespaces {
			namespaceUIDs = append(namespaceUIDs, k)
		}
	}

	ruleGroups := opts.Query["rule_group"]
	ruleUIDs := opts.Query["rule_uid"]

	receiverName := opts.Query.Get("receiver_name")
	title := opts.Query.Get("search.rule_name")
	dataSourceUIDs := opts.Query["datasource_uid"]
	searchRuleGroup := opts.Query.Get("search.rule_group")

	alertRuleQuery := ngmodels.ListAlertRulesQuery{
		OrgID:           opts.OrgID,
		NamespaceUIDs:   namespaceUIDs,
		RuleUIDs:        ruleUIDs,
		DashboardUID:    dashboardUID,
		PanelID:         panelID,
		RuleGroups:      ruleGroups,
		ReceiverName:    receiverName,
		SearchTitle:     title,
		SearchRuleGroup: searchRuleGroup,
		DataSourceUIDs:  dataSourceUIDs,
	}
	ruleList, err := store.ListAlertRules(opts.Ctx, &alertRuleQuery)
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		return ruleResponse
	}

	ruleNames := opts.Query["rule_name"]
	ruleNamesSet := make(map[string]struct{}, len(ruleNames))
	for _, rn := range ruleNames {
		ruleNamesSet[rn] = struct{}{}
	}

	maxGroups := getInt64WithDefault(opts.Query, "group_limit", -1)
	nextToken := opts.Query.Get("group_next_token")
	if nextToken != "" {
		if _, err := base64.URLEncoding.DecodeString(nextToken); err != nil {
			nextToken = ""
		}
	}

	groupedRules := getGroupedRules(log, ruleList, ruleNamesSet, opts.AllowedNamespaces)
	rulesTotals := make(map[string]int64, len(groupedRules))
	var newToken string
	foundToken := false
	for _, rg := range groupedRules {
		if nextToken != "" && !foundToken {
			if !tokenGreaterThanOrEqual(getRuleGroupNextToken(rg.Folder, rg.GroupKey.RuleGroup), nextToken) {
				continue
			}
			foundToken = true
		}

		if maxGroups > -1 && len(ruleResponse.Data.RuleGroups) == int(maxGroups) {
			newToken = getRuleGroupNextToken(rg.Folder, rg.GroupKey.RuleGroup)
			break
		}

		ruleGroup, totals := toRuleGroup(log, rg.GroupKey, rg.Folder, rg.Rules, provenanceRecords, limitAlertsPerRule, stateFilterSet, matchers, labelOptions, ruleStatusMutator, alertStateMutator)
		ruleGroup.Totals = totals
		for k, v := range totals {
			rulesTotals[k] += v
		}

		if len(stateFilterSet) > 0 {
			filterRulesByState(ruleGroup, stateFilterSet)
		}

		if len(healthFilterSet) > 0 {
			filterRulesByHealth(ruleGroup, healthFilterSet)
		}

		if limitRulesPerGroup > -1 && int64(len(ruleGroup.Rules)) > limitRulesPerGroup {
			ruleGroup.Rules = ruleGroup.Rules[0:limitRulesPerGroup]
		}

		if len(ruleGroup.Rules) > 0 {
			ruleResponse.Data.RuleGroups = append(ruleResponse.Data.RuleGroups, *ruleGroup)
		}
	}

	ruleResponse.Data.NextToken = newToken

	// Only return Totals if there is no pagination
	if maxGroups == -1 {
		ruleResponse.Data.Totals = rulesTotals
	}

	return ruleResponse
}

func getRuleGroupNextToken(namespace, group string) string {
	return base64.URLEncoding.EncodeToString([]byte(namespace + "/" + group))
}

// Returns true if tokenA >= tokenB
func tokenGreaterThanOrEqual(tokenA string, tokenB string) bool {
	decodedTokenA, _ := base64.URLEncoding.DecodeString(tokenA)
	decodedTokenB, _ := base64.URLEncoding.DecodeString(tokenB)

	return string(decodedTokenA) >= string(decodedTokenB)
}

type ruleGroup struct {
	Folder   string
	GroupKey ngmodels.AlertRuleGroupKey
	Rules    []*ngmodels.AlertRule
}

// Returns a slice of rule groups ordered by namespace and group name
func getGroupedRules(log log.Logger, ruleList ngmodels.RulesGroup, ruleNamesSet map[string]struct{}, namespaceMap map[string]string) []*ruleGroup {
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

	ruleGroups := make([]*ruleGroup, 0, len(groupedRules))
	for groupKey, groupRules := range groupedRules {
		folder, ok := namespaceMap[groupKey.NamespaceUID]
		if !ok {
			log.Warn("Query returned rules that belong to folder the user does not have access to. All rules that belong to that namespace will not be added to the response", "folder_uid", groupKey.NamespaceUID)
			continue
		}

		// Sort the rules in each rule group by index. We do this at the end instead of
		// after each append to avoid having to sort each group multiple times.
		ngmodels.AlertRulesBy(ngmodels.AlertRulesByIndex).Sort(groupRules)

		ruleGroups = append(ruleGroups, &ruleGroup{
			Folder:   folder,
			GroupKey: groupKey,
			Rules:    groupRules,
		})
	}

	// Sort the groups first by namespace, then group name
	slices.SortFunc(ruleGroups, func(a, b *ruleGroup) int {
		nsCmp := strings.Compare(a.Folder, b.Folder)
		if nsCmp != 0 {
			return nsCmp
		}

		// If Namespaces are equal, check the group names
		return strings.Compare(a.GroupKey.RuleGroup, b.GroupKey.RuleGroup)
	})

	return ruleGroups
}

func filterRulesByState(ruleGroup *apimodels.RuleGroup, withStatesFast map[eval.State]struct{}) {
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
		case "recovering":
			state = util.Pointer(eval.Recovering)
		}
		if state != nil {
			if _, ok := withStatesFast[*state]; ok {
				filteredRules = append(filteredRules, rule)
			}
		}
	}
	ruleGroup.Rules = filteredRules
}

func filterRulesByHealth(ruleGroup *apimodels.RuleGroup, withHealthFast map[string]struct{}) {
	// Filtering is weird but error and nodata filters also need to be
	// applied to the rule. Others such as firing, pending, and normal should have no effect.
	// This is to match the current behavior in the UI.
	filteredRules := make([]apimodels.AlertingRule, 0, len(ruleGroup.Rules))
	for _, rule := range ruleGroup.Rules {
		if _, ok := withHealthFast[rule.Health]; ok {
			filteredRules = append(filteredRules, rule)
		}
	}
	ruleGroup.Rules = filteredRules
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

func toRuleGroup(log log.Logger, groupKey ngmodels.AlertRuleGroupKey, folderFullPath string, rules []*ngmodels.AlertRule, provenanceRecords map[string]ngmodels.Provenance, limitAlerts int64, stateFilterSet map[eval.State]struct{}, matchers labels.Matchers, labelOptions []ngmodels.LabelOption, ruleStatusMutator RuleStatusMutator, ruleAlertStateMutator RuleAlertStateMutator) (*apimodels.RuleGroup, map[string]int64) {
	newGroup := &apimodels.RuleGroup{
		Name: groupKey.RuleGroup,
		// file is what Prometheus uses for provisioning, we replace it with namespace which is the folder in Grafana.
		File:      folderFullPath,
		FolderUID: groupKey.NamespaceUID,
	}

	rulesTotals := make(map[string]int64, len(rules))

	ngmodels.RulesGroup(rules).SortByGroupIndex()
	for _, rule := range rules {
		provenance := ngmodels.ProvenanceNone
		if prov, exists := provenanceRecords[rule.ResourceID()]; exists {
			provenance = prov
		}
		alertingRule := apimodels.AlertingRule{
			State:                 "inactive",
			Name:                  rule.Title,
			Query:                 ruleToQuery(log, rule),
			QueriedDatasourceUIDs: extractDatasourceUIDs(rule),
			Duration:              rule.For.Seconds(),
			KeepFiringFor:         rule.KeepFiringFor.Seconds(),
			Annotations:           apimodels.LabelsFromMap(rule.Annotations),
			Rule: apimodels.Rule{
				UID:        rule.UID,
				Name:       rule.Title,
				FolderUID:  rule.NamespaceUID,
				Labels:     apimodels.LabelsFromMap(rule.GetLabels(labelOptions...)),
				Type:       rule.Type().String(),
				IsPaused:   rule.IsPaused,
				Provenance: apimodels.Provenance(provenance),
			},
		}

		// mutate rule to apply status fields
		ruleStatusMutator(rule, &alertingRule)

		if len(rule.NotificationSettings) > 0 {
			alertingRule.NotificationSettings = (*apimodels.AlertRuleNotificationSettings)(&rule.NotificationSettings[0])
		}

		// mutate rule for alert states
		totals, totalsFiltered := ruleAlertStateMutator(rule, &alertingRule, stateFilterSet, matchers, labelOptions)

		if alertingRule.State != "" {
			rulesTotals[alertingRule.State] += 1
		}

		if alertingRule.Health == "error" || alertingRule.Health == "nodata" {
			rulesTotals[alertingRule.Health] += 1
		}

		alertsBy := apimodels.AlertsBy(apimodels.AlertsByImportance)

		if limitAlerts > -1 && int64(len(alertingRule.Alerts)) > limitAlerts {
			alertingRule.Alerts = alertsBy.TopK(alertingRule.Alerts, int(limitAlerts))
		} else {
			// If there is no effective limit, then just sort the alerts.
			// For large numbers of alerts, this can be faster.
			alertsBy.Sort(alertingRule.Alerts)
		}

		alertingRule.Totals = totals
		alertingRule.TotalsFiltered = totalsFiltered
		newGroup.Rules = append(newGroup.Rules, alertingRule)
		newGroup.Interval = float64(rule.IntervalSeconds)
		// TODO yuri. Change that when scheduler will process alerts in groups
		newGroup.EvaluationTime = alertingRule.EvaluationTime
		newGroup.LastEvaluation = alertingRule.LastEvaluation
	}

	return newGroup, rulesTotals
}

// extractDatasourceUIDs extracts datasource UIDs from a rule
func extractDatasourceUIDs(rule *ngmodels.AlertRule) []string {
	queriedDatasourceUIDs := make([]string, 0, len(rule.Data))
	for _, query := range rule.Data {
		// Skip expression datasources (UID -100 or __expr__)
		if expr.IsDataSource(query.DatasourceUID) {
			continue
		}
		queriedDatasourceUIDs = append(queriedDatasourceUIDs, query.DatasourceUID)
	}
	return queriedDatasourceUIDs
}

// ruleToQuery attempts to extract the datasource queries from the alert query model.
// Returns the whole JSON model as a string if it fails to extract a minimum of 1 query.
func ruleToQuery(logger log.Logger, rule *ngmodels.AlertRule) string {
	var queryErr error

	queries := make([]string, 0, len(rule.Data))
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

func errorOrEmpty(err error) string {
	if err != nil {
		return err.Error()
	}
	return ""
}
