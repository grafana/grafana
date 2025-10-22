package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"

	gojson "github.com/goccy/go-json"
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

// GoJsonResponse is a custom response type that uses goccy/go-json for faster JSON encoding.
// This is specifically designed for the Prometheus rules API endpoint which can return large payloads.
type GoJsonResponse struct {
	status int
	body   any
}

// Status returns the HTTP status code.
func (r GoJsonResponse) Status() int {
	return r.status
}

// Body returns nil as this is a streaming response.
func (r GoJsonResponse) Body() []byte {
	return nil
}

// WriteTo writes the JSON response using goccy/go-json encoder.
func (r GoJsonResponse) WriteTo(ctx *contextmodel.ReqContext) {
	ctx.Resp.Header().Set("Content-Type", "application/json; charset=utf-8")
	ctx.Resp.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	ctx.Resp.WriteHeader(r.status)
	enc := gojson.NewEncoder(ctx.Resp)
	if err := enc.Encode(r.body); err != nil {
		ctx.Logger.Error("Error encoding JSON with goccy/go-json", "err", err)
	}
}

// newGoJsonResponse creates a new GoJsonResponse.
func newGoJsonResponse(status int, body any) response.Response {
	return &GoJsonResponse{
		status: status,
		body:   body,
	}
}

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

	// Initialize Server-Timing collector
	timingCollector := NewServerTimingCollector()
	timingCollector.Start("total")

	// Attach timing collector to context for propagation to lower layers
	ctx := ContextWithTimingCollector(c.Req.Context(), timingCollector)

	ruleResponse := apimodels.RuleResponse{
		DiscoveryBase: apimodels.DiscoveryBase{
			Status: "success",
		},
		Data: apimodels.RuleDiscovery{
			RuleGroups: []apimodels.RuleGroup{},
		},
	}

	timingCollector.Start("namespaces")
	namespaceMap, err := srv.store.GetUserVisibleNamespaces(ctx, c.GetOrgID(), c.SignedInUser)
	timingCollector.End("namespaces", "Get user visible namespaces")
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failed to get namespaces visible to the user: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		timingCollector.End("total", "Total request time")
		return NewGoJsonResponseWithTiming(ruleResponse.HTTPStatusCode(), ruleResponse, timingCollector.GetTimings())
	}

	timingCollector.Start("authz")
	allowedNamespaces := map[string]string{}
	for namespaceUID, folder := range namespaceMap {
		// only add namespaces that the user has access to rules in
		hasAccess, err := srv.authz.HasAccessInFolder(ctx, c.SignedInUser, ngmodels.Namespace(*folder.ToFolderReference()))
		if err != nil {
			ruleResponse.Status = "error"
			ruleResponse.Error = fmt.Sprintf("failed to get namespaces visible to the user: %s", err.Error())
			ruleResponse.ErrorType = apiv1.ErrServer
			timingCollector.End("total", "Total request time")
			return NewGoJsonResponseWithTiming(ruleResponse.HTTPStatusCode(), ruleResponse, timingCollector.GetTimings())
		}
		if hasAccess {
			allowedNamespaces[namespaceUID] = folder.Fullpath
		}
	}
	timingCollector.End("authz", "Authorization checks")

	timingCollector.Start("provenance")
	provenanceRecords, err := srv.provenanceStore.GetProvenances(ctx, c.GetOrgID(), (&ngmodels.AlertRule{}).ResourceType())
	timingCollector.End("provenance", "Get provenance records")
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failed to get provenances visible to the user: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		timingCollector.End("total", "Total request time")
		return NewGoJsonResponseWithTiming(ruleResponse.HTTPStatusCode(), ruleResponse, timingCollector.GetTimings())
	}

	timingCollector.Start("prepare")
	ruleResponse = PrepareRuleGroupStatusesV2(
		srv.log,
		srv.store,
		RuleGroupStatusesOptions{
			Ctx:               ctx, // Pass context with timing collector
			OrgID:             c.OrgID,
			Query:             c.Req.Form,
			AllowedNamespaces: allowedNamespaces,
		},
		RuleStatusMutatorGenerator(srv.status),
		RuleAlertStateMutatorGenerator(srv.manager),
		provenanceRecords,
	)
	timingCollector.End("prepare", "Prepare rule group statuses")

	// Measure JSON encoding time by pre-encoding the response
	// This gives us accurate timing AND avoids double-encoding
	timingCollector.Start("json_encode")
	preencodedJSON, encodeErr := gojson.Marshal(ruleResponse)
	timingCollector.End("json_encode", "JSON response encoding")

	timingCollector.End("total", "Total request time")

	// Return response with pre-encoded JSON (or nil if encoding failed)
	if encodeErr != nil {
		srv.log.Error("Failed to encode response", "error", encodeErr)
		// Return without pre-encoding, will encode on-the-fly
		return NewGoJsonResponseWithTiming(ruleResponse.HTTPStatusCode(), ruleResponse, timingCollector.GetTimings())
	}

	return NewGoJsonResponseWithTimingAndPreencoded(ruleResponse.HTTPStatusCode(), ruleResponse, preencodedJSON, timingCollector.GetTimings())
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
		// Time state manager query if collector present in context
		// Note: We can't easily pass context here, so we'll track this in process_groups timing
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

func PrepareRuleGroupStatusesV2(log log.Logger, store ListAlertRulesStoreV2, opts RuleGroupStatusesOptions, ruleStatusMutator RuleStatusMutator, alertStateMutator RuleAlertStateMutator, provenanceRecords map[string]ngmodels.Provenance) apimodels.RuleResponse {
	// Extract timing collector from context if present
	collector := TimingCollectorFromContext(opts.Ctx)

	if collector != nil {
		collector.Start("parse_query")
	}

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

	// Note: rule_group is extracted for substring filtering later, not passed to store for exact matching
	receiverName := opts.Query.Get("receiver_name")

	maxGroups := getInt64WithDefault(opts.Query, "group_limit", -1)
	nextToken := opts.Query.Get("group_next_token")

	if maxGroups == 0 {
		return ruleResponse
	}

	// Extract rule type filter (alerting/recording)
	ruleType := ngmodels.RuleTypeFilterAll
	if typeParam := opts.Query.Get("type"); typeParam != "" {
		switch typeParam {
		case "alerting":
			ruleType = ngmodels.RuleTypeFilterAlerting
		case "recording":
			ruleType = ngmodels.RuleTypeFilterRecording
		}
	}

	// Extract label filters for backend filtering
	labelFilters := make([]string, 0)
	if len(matchers) > 0 {
		for _, matcher := range matchers {
			// Convert Prometheus matcher to string format for backend
			// Prometheus MatchType: MatchEqual=0, MatchNotEqual=1, MatchRegexp=2, MatchNotRegexp=3
			var op string
			switch matcher.Type {
			case 0: // MatchEqual
				op = "="
			case 1: // MatchNotEqual
				op = "!="
			case 2: // MatchRegexp
				op = "=~"
			case 3: // MatchNotRegexp
				op = "!~"
			default:
				op = "="
			}
			labelFilters = append(labelFilters, fmt.Sprintf("%s%s%s", matcher.Name, op, matcher.Value))
		}
	}

	// Extract hide_plugins filter
	hidePlugins := getBoolWithDefault(opts.Query, "hide_plugins", false)

	// Extract datasource_uid filter (can be multiple)
	datasourceUIDs := opts.Query["datasource_uid"]

	// Extract filters - all will be applied at store level
	namespaceFilter := opts.Query.Get("namespace")
	ruleGroupFilter := opts.Query.Get("rule_group")
	ruleNameFilter := opts.Query.Get("rule_name")

	if collector != nil {
		collector.End("parse_query", "Parse and validate query parameters")
		collector.Start("db_query")
	}

	byGroupQuery := ngmodels.ListAlertRulesExtendedQuery{
		ListAlertRulesQuery: ngmodels.ListAlertRulesQuery{
			OrgID:         opts.OrgID,
			NamespaceUIDs: namespaceUIDs,
			DashboardUID:  dashboardUID,
			PanelID:       panelID,
			ReceiverName:  receiverName,
		},
		RuleType:        ruleType,
		Labels:          labelFilters,
		Namespace:       namespaceFilter, // Backend does case-insensitive substring match
		GroupName:       ruleGroupFilter, // Backend does case-insensitive substring match
		RuleName:        ruleNameFilter,  // Backend does case-insensitive substring match
		HidePluginRules: hidePlugins,
		DatasourceUIDs:  datasourceUIDs,
		Limit:           maxGroups,
		ContinueToken:   nextToken,
		DisableCache:    false,
	}
	ruleList, continueToken, err := store.ListAlertRulesByGroup(opts.Ctx, &byGroupQuery)
	if collector != nil {
		// Add cache status to description
		cacheDesc := "Fetch rules"
		if collector.HasCacheHits() {
			cacheDesc = "Fetch rules (from cache)"
			log.Info("Cache status", "hits", true)
		} else if collector.HasCacheMisses() || collector.HasDBQueries() {
			cacheDesc = "Fetch rules (from database)"
			log.Info("Cache status", "miss_or_db", true, "has_misses", collector.HasCacheMisses(), "has_db", collector.HasDBQueries())
		} else {
			log.Info("Cache status", "none", true)
		}
		collector.End("db_query", cacheDesc)
	}
	if err != nil {
		ruleResponse.Status = "error"
		ruleResponse.Error = fmt.Sprintf("failure getting rules: %s", err.Error())
		ruleResponse.ErrorType = apiv1.ErrServer
		return ruleResponse
	}

	if collector != nil {
		collector.Start("filter_group")
	}
	// All filtering done at store level - just group the results
	groupedRules := getGroupedRules(log, ruleList, nil, opts.AllowedNamespaces)

	if collector != nil {
		collector.End("filter_group", "Filter and paginate rule groups")
		collector.Start("process_groups")
	}

	// PERFORMANCE OPTIMIZATION: Process rule groups in parallel to overlap state manager I/O
	// Use worker pool to limit concurrency
	type groupResult struct {
		ruleGroup *apimodels.RuleGroup
		totals    map[string]int64
		index     int
	}

	workerCount := 8 // Tune based on CPU cores and state manager capacity
	resultsChan := make(chan groupResult, len(groupedRules))
	semaphore := make(chan struct{}, workerCount)
	var wg sync.WaitGroup

	for i, rg := range groupedRules {
		wg.Add(1)
		semaphore <- struct{}{} // Acquire
		go func(idx int, rg *ruleGroup) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release

			ruleGroup, totals := toRuleGroup(log, rg.GroupKey, rg.Folder, rg.Rules, provenanceRecords, limitAlertsPerRule, stateFilterSet, matchers, labelOptions, ruleStatusMutator, alertStateMutator)
			ruleGroup.Totals = totals

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
				resultsChan <- groupResult{
					ruleGroup: ruleGroup,
					totals:    totals,
					index:     idx,
				}
			}
		}(i, rg)
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	// Collect results in order
	results := make([]groupResult, 0, len(groupedRules))
	for result := range resultsChan {
		results = append(results, result)
	}

	// Sort by original index to maintain order
	sort.Slice(results, func(i, j int) bool {
		return results[i].index < results[j].index
	})

	if collector != nil {
		collector.End("process_groups", fmt.Sprintf("Process %d rule groups (parallel)", len(groupedRules)))
		collector.Start("serialize")
	}

	// Build final response
	rulesTotals := make(map[string]int64)
	for _, result := range results {
		ruleResponse.Data.RuleGroups = append(ruleResponse.Data.RuleGroups, *result.ruleGroup)
		for k, v := range result.totals {
			rulesTotals[k] += v
		}
	}

	ruleResponse.Data.NextToken = continueToken

	// Only return Totals if there is no pagination
	if maxGroups == -1 {
		ruleResponse.Data.Totals = rulesTotals
	}

	if collector != nil {
		collector.End("serialize", "Build final response structure")
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

	receiverName := opts.Query.Get("receiver_name")

	alertRuleQuery := ngmodels.ListAlertRulesQuery{
		OrgID:         opts.OrgID,
		NamespaceUIDs: namespaceUIDs,
		DashboardUID:  dashboardUID,
		PanelID:       panelID,
		RuleGroups:    ruleGroups,
		ReceiverName:  receiverName,
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
