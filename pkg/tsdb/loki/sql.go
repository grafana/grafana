package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/loki/kinds/dataquery"
)

// grafanaSQLQuery extends schemas.Query with fields from the dsabstraction tabular model
// that are not on schemas.Query.
type grafanaSQLQuery struct {
	schemas.Query
	Aggregation *aggregationHint `json:"aggregation,omitempty"`
}

// aggregationHint describes an aggregation pushed down from the SQL engine.
type aggregationHint struct {
	Function string   `json:"function"` // e.g. "SUM", "AVG", "COUNT", "MIN", "MAX"
	Column   string   `json:"column"`   // e.g. "value", "bytes", "line"
	GroupBy  []string `json:"groupBy"`  // label names; timestamp/time excluded from LogQL grouping
}

// sqlKind classifies a successfully-rewritten Grafana SQL query so callers can route the response
// through the right flattener (log vs metric tabular).
type sqlKind string

const (
	sqlKindLog    sqlKind = "log"
	sqlKindMetric sqlKind = "metric"
)

// Grafana SQL table hint keys (TableHintValues; uppercase matches schemads / dsabstraction).
const (
	grafanaSQLHintStep      = "STEP"
	grafanaSQLHintRate      = "RATE"
	grafanaSQLHintDirection = "DIRECTION"
	grafanaSQLHintInstant   = "INSTANT"
	lokiQueryTypeRange      = "range"
	lokiQueryTypeInstant    = "instant"
	logDirectionForward     = "forward"
	logDirectionBackward    = "backward"
	logqlAggregateOpSum     = "sum"
	logqlAggregateOpAvg     = "avg"
	logqlAggregateOpMin     = "min"
	logqlAggregateOpMax     = "max"
	metricColumnBytes       = "bytes"
)

// dsAbstractionEnabled reports whether PluginContext.GrafanaConfig enables dsAbstractionApp.
func dsAbstractionEnabled(req *backend.QueryDataRequest) bool {
	if req == nil {
		return false
	}
	gc := req.PluginContext.GrafanaConfig
	if gc == nil {
		return false
	}
	return gc.FeatureToggles().IsEnabled(flagDsAbstractionApp)
}

// normalizeGrafanaSQLRequest rewrites schemads Grafana SQL payloads into native Loki queries embedded
// in each DataQuery's JSON. Queries without GrafanaSql=true are unchanged.
//
// sqlErrors maps refId to conversion errors for Grafana SQL queries that could not be rewritten;
// those queries are omitted from the returned request (callers attach sqlErrors to the response).
//
// Eligibility: runs only when dsAbstractionEnabled(req) is true. The first Grafana SQL
// row resolves the stream table label via resolveTableLabel; that requires a non-nil datasource
// instance with SchemaProvider.
//
// Log vs metric (rewriteSQLQuery): metric when json aggregation is non-nil OR TableHintValues
// contains a non-empty RATE hint after parseSQLHints; otherwise log. Log queries always use Loki's
// range API. Metric queries use range or instant query type per the INSTANT hint (instant is rejected for log queries).
//
// TableHintValues (parsed in parseSQLHints; keys compared case-insensitively via hintGet / instantHintEnabled):
//
//	STEP, RATE — Grafana duration strings; invalid values fail the rewrite.
//	DIRECTION — forward/backward; applied on log queries only (QueryJSONModel.Direction).
//	INSTANT — key presence selects instant API for metric queries only.
//	PARSER — LogQL parser pipeline fragment (e.g. json, json | unpack, pattern "<expr>");
//	appended after the stream selector; routes non-stream filters to pipeline label filters.
//
// Positive schemas.Query.limit is mapped to Loki MaxLines on log queries only (buildLogPlan).
//
// Details live in parseSQLHints, rewriteSQLQuery, buildLogPlan, and buildMetricPlan.
//
// Returns sqlKinds so queryData can apply flattenLogsToTabular vs flattenMetricsToTabular per refID.
//
// The datasource instance should have been created with dsAbstractionApp enabled so SchemaProvider
// exists; otherwise resolveTableLabel fails.
func normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo) (*backend.QueryDataRequest, map[string]sqlKind, map[string]error) {
	if req == nil || len(req.Queries) == 0 {
		return req, nil, nil
	}

	if !dsAbstractionEnabled(req) {
		return req, nil, nil
	}

	out := make([]backend.DataQuery, 0, len(req.Queries))
	sqlKinds := make(map[string]sqlKind)
	sqlErrors := make(map[string]error)

	var tableLabel string
	for _, q := range req.Queries {
		var sq grafanaSQLQuery
		if err := json.Unmarshal(q.JSON, &sq); err != nil {
			out = append(out, q)
			continue
		}
		if !sq.GrafanaSql {
			out = append(out, q)
			continue
		}
		if sq.Table == "" {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: table name is required")
			continue
		}

		if tableLabel == "" {
			var err error
			tableLabel, err = resolveTableLabel(ctx, dsInfo)
			if err != nil {
				sqlErrors[q.RefID] = err
				continue
			}
		}

		rewritten, kind, err := rewriteSQLQuery(ctx, q, sq, tableLabel, dsInfo)
		if err != nil {
			sqlErrors[q.RefID] = err
			continue
		}
		out = append(out, rewritten)
		sqlKinds[q.RefID] = kind
	}

	req.Queries = out
	return req, sqlKinds, sqlErrors
}

// sqlHints holds the table hints parsed once per query so buildLogPlan / buildMetricPlan can
// share a uniform signature.
type sqlHints struct {
	stepStr   string        // raw STEP hint value, "" if absent
	stepDur   time.Duration // parsed STEP duration, 0 if absent
	rateStr   string        // raw RATE hint value, "" if absent
	rateDur   time.Duration // parsed RATE duration, 0 if absent
	direction string        // lowercased DIRECTION hint, "" if absent
	instant   bool          // INSTANT hint key presence
	parser    string        // LogQL parser stage fragment (e.g. json, pattern "<expr>"), "" if absent
}

// parseSQLHints validates and extracts the TableHintValues supported by Loki Grafana SQL. Errors
// are prefixed with "loki grafana sql:" so callers can surface them directly.
func parseSQLHints(hints map[string]string) (sqlHints, error) {
	var h sqlHints
	var err error
	if h.stepStr, h.stepDur, err = parseDurationHint(hints, grafanaSQLHintStep); err != nil {
		return h, fmt.Errorf("loki grafana sql: %w", err)
	}
	if h.rateStr, h.rateDur, err = parseDurationHint(hints, grafanaSQLHintRate); err != nil {
		return h, fmt.Errorf("loki grafana sql: %w", err)
	}
	h.direction = strings.ToLower(hintGet(hints, grafanaSQLHintDirection))
	h.instant = instantHintEnabled(hints)
	if hintGet(hints, grafanaSQLHintParser) != "" {
		stage, err := buildParserStage(hints)
		if err != nil {
			return h, fmt.Errorf("loki grafana sql: %w", err)
		}
		h.parser = stage
	}
	return h, nil
}

// queryPlan captures the result of compiling a Grafana SQL query into a Loki query. Fields encode
// the post-resolution invariants directly so the orchestrator just applies them (e.g. modelStep is
// already cleared for instant metric queries while intervalStep retains the duration used to
// override q.Interval).
type queryPlan struct {
	expr         string
	queryType    string        // lokiQueryTypeRange or lokiQueryTypeInstant
	intervalStep time.Duration // 0 means don't override q.Interval/MaxDataPoints
	modelStep    string        // "" means don't set model.Step
	maxLines     int64         // 0 means don't set model.MaxLines
	direction    *string       // nil for metric queries
	kind         sqlKind
}

// buildLogPlan compiles a log-stream Grafana SQL query (no aggregation, no RATE) into a queryPlan.
// Log queries always use Loki's range API; STEP is honoured as-is when provided.
func buildLogPlan(selector string, sq grafanaSQLQuery, hints sqlHints) queryPlan {
	plan := queryPlan{
		expr:      selector,
		queryType: lokiQueryTypeRange,
		modelStep: hints.stepStr,
		direction: directionPtr(hints.direction),
		kind:      sqlKindLog,
	}
	if hints.stepStr != "" && hints.stepDur > 0 {
		plan.intervalStep = hints.stepDur
	}
	if sq.Limit != nil && *sq.Limit > 0 {
		plan.maxLines = *sq.Limit
	}
	return plan
}

// buildMetricPlan compiles a metric (aggregation and/or RATE) Grafana SQL query into a queryPlan.
// queryDur is the request time range; it backs the default step when neither STEP nor RATE is set.
// Instant plans intentionally leave modelStep empty (Loki's instant API has no step) while
// intervalStep still carries the underlying duration so q.Interval is updated.
func buildMetricPlan(selector string, sq grafanaSQLQuery, hints sqlHints, queryDur time.Duration) (queryPlan, error) {
	win := metricRangeWindow(hints.stepDur, queryDur)
	expr, err := buildGrafanaSQLMetricExpr(selector, sq.Aggregation, win, hints.rateDur)
	if err != nil {
		return queryPlan{}, fmt.Errorf("loki grafana sql: %w", err)
	}

	stepDur := hints.stepDur
	stepStr := hints.stepStr
	if !hints.instant && stepStr == "" && stepDur == 0 {
		if hints.rateStr != "" {
			stepDur = hints.rateDur
			stepStr = gtime.FormatInterval(hints.rateDur)
		} else {
			stepDur = win
			stepStr = gtime.FormatInterval(win)
		}
	}

	plan := queryPlan{
		expr: expr,
		kind: sqlKindMetric,
	}
	if hints.instant {
		plan.queryType = lokiQueryTypeInstant
	} else {
		plan.queryType = lokiQueryTypeRange
		plan.modelStep = stepStr
	}
	if stepStr != "" && stepDur > 0 {
		plan.intervalStep = stepDur
	}
	return plan, nil
}

// rewriteSQLQuery compiles one Grafana SQL query into a native Loki query and embeds the resulting
// QueryJSONModel in the returned DataQuery's JSON. Callers must have already validated
// sq.GrafanaSql == true and sq.Table != "". Returns sqlKindLog or sqlKindMetric so callers can
// dispatch response-frame flattening. Returned errors are prefixed with "loki grafana sql:" and
// intended to be surfaced to the user as-is.
func rewriteSQLQuery(ctx context.Context, q backend.DataQuery, sq grafanaSQLQuery, tableLabel string, dsInfo *datasourceInfo) (backend.DataQuery, sqlKind, error) {
	hints, err := parseSQLHints(sq.TableHintValues)
	if err != nil {
		return q, "", err
	}

	expr, err := buildLogQLPipeline(ctx, tableLabel, sq.Table, sq.Filters, hints, dsInfo)
	if err != nil {
		return q, "", fmt.Errorf("loki grafana sql: failed to build LogQL: %w", err)
	}

	isMetric := sq.Aggregation != nil || hints.rateStr != ""
	if hints.instant && !isMetric {
		return q, "", fmt.Errorf("loki grafana sql: %s hint requires a metric query (aggregation or %s)", grafanaSQLHintInstant, grafanaSQLHintRate)
	}

	if isMetric && hints.parser != "" && sq.Aggregation != nil {
		if err := rejectParsedMetricAggregation(ctx, sq.Table, sq.Aggregation, hints, dsInfo); err != nil {
			return q, "", err
		}
	}

	var plan queryPlan
	if isMetric {
		plan, err = buildMetricPlan(expr, sq, hints, q.TimeRange.Duration())
		if err != nil {
			return q, "", err
		}
	} else {
		plan = buildLogPlan(expr, sq, hints)
	}

	if plan.intervalStep > 0 {
		q.Interval = plan.intervalStep
		q.MaxDataPoints = int64(q.TimeRange.Duration() / plan.intervalStep)
		if q.MaxDataPoints < 1 {
			q.MaxDataPoints = 1
		}
	}

	model := QueryJSONModel{
		LokiDataQuery: dataqueryFromExpr(q.RefID, plan.expr, plan.queryType, plan.maxLines, plan.modelStep),
		Direction:     plan.direction,
	}

	raw, err := json.Marshal(model)
	if err != nil {
		return q, "", fmt.Errorf("loki grafana sql: marshal query model: %w", err)
	}

	q.JSON = raw
	return q, plan.kind, nil
}

// resolveTableLabel returns the label used to partition Grafana SQL tables for this datasource.
func resolveTableLabel(ctx context.Context, dsInfo *datasourceInfo) (string, error) {
	if dsInfo == nil {
		return "", fmt.Errorf("loki grafana sql: data source instance is missing")
	}
	if dsInfo.schemaProvider == nil {
		return "", fmt.Errorf("loki grafana sql: data source instance has no schema provider")
	}
	return dsInfo.schemaProvider.ResolveSchemaTableLabel(ctx), nil
}

// parseDurationHint returns the raw value and parsed Grafana duration for a TableHintValues entry.
// Returns ("", 0, nil) when the hint is absent. Parse errors are wrapped with the hint key so they
// surface as e.g. `failed to parse STEP hint "..."`.
func parseDurationHint(hints map[string]string, key string) (string, time.Duration, error) {
	raw := hintGet(hints, key)
	if raw == "" {
		return "", 0, nil
	}
	dur, err := gtime.ParseIntervalStringToTimeDuration(raw)
	if err != nil {
		return "", 0, fmt.Errorf("failed to parse %s hint %q: %w", key, raw, err)
	}
	return raw, dur, nil
}

func dataqueryFromExpr(refID, expr, queryType string, maxLines int64, step string) dataquery.LokiDataQuery {
	q := dataquery.LokiDataQuery{
		Expr:  expr,
		RefId: refID,
	}
	qt := queryType
	q.QueryType = &qt
	if maxLines > 0 {
		q.MaxLines = &maxLines
	}
	if step != "" {
		s := step
		q.Step = &s
	}
	return q
}

func directionPtr(dir string) *string {
	switch dir {
	case logDirectionForward, logDirectionBackward:
		return &dir
	default:
		return nil
	}
}

func metricRangeWindow(stepDur time.Duration, queryDur time.Duration) time.Duration {
	if stepDur > 0 {
		return stepDur
	}
	if queryDur > 0 && queryDur < time.Minute {
		return queryDur
	}
	return time.Minute
}

// instantHintEnabled reports whether TableHintValues include INSTANT (key presence only; same as promlib).
func instantHintEnabled(hints map[string]string) bool {
	if hints == nil {
		return false
	}
	for k := range hints {
		if strings.EqualFold(k, grafanaSQLHintInstant) {
			return true
		}
	}
	return false
}

// buildGrafanaSQLMetricExpr builds LogQL for Grafana SQL metric pushdown.
// When rateDur > 0, the RATE table hint is applied (rate or bytes_rate); otherwise range-vector
// helpers like count_over_time are used (compare promlib buildPromQLExpr ordering).
func buildGrafanaSQLMetricExpr(selector string, agg *aggregationHint, window time.Duration, rateDur time.Duration) (string, error) {
	if agg == nil {
		if rateDur <= 0 {
			return "", fmt.Errorf("metric expression requires an aggregation hint or RATE table hint")
		}
		return wrapLogQLRate(selector, "", rateDur), nil
	}

	fn := strings.ToUpper(strings.TrimSpace(agg.Function))
	switch fn {
	case "SUM", "AVG", "MIN", "MAX", "COUNT":
	default:
		return "", fmt.Errorf("unsupported aggregation function %q", agg.Function)
	}

	var inner string
	var err error
	if rateDur > 0 {
		inner = wrapLogQLRate(selector, agg.Column, rateDur)
	} else {
		inner, err = innerMetricRangeVector(selector, fn, agg.Column, window)
		if err != nil {
			return "", err
		}
	}

	grouping := aggregationGroupLabels(agg)
	switch fn {
	// COUNT uses outer sum(): inner already counts per stream (count_over_time / rate); sum merges
	// those partial counts into one value per SQL GROUP BY bucket (PromQL/Loki idiom).
	case "COUNT":
		return wrapLogQLAggregate(logqlAggregateOpSum, grouping, inner), nil
	case "SUM":
		return wrapLogQLAggregate(logqlAggregateOpSum, grouping, inner), nil
	case "AVG":
		return wrapLogQLAggregate(logqlAggregateOpAvg, grouping, inner), nil
	case "MIN":
		return wrapLogQLAggregate(logqlAggregateOpMin, grouping, inner), nil
	case "MAX":
		return wrapLogQLAggregate(logqlAggregateOpMax, grouping, inner), nil
	default:
		return "", fmt.Errorf("unsupported aggregation function %q", agg.Function)
	}
}

func wrapLogQLRate(logQuery string, column string, d time.Duration) string {
	bracket := logQLRangeBracket(logQuery, d)
	col := strings.ToLower(strings.TrimSpace(column))
	if col == metricColumnBytes {
		return fmt.Sprintf("bytes_rate(%s)", bracket)
	}
	return fmt.Sprintf("rate(%s)", bracket)
}

func logQLRangeBracket(logQuery string, d time.Duration) string {
	w := gtime.FormatInterval(d)
	bracket := "[" + w + "]"
	if strings.Contains(logQuery, " | ") {
		return logQuery + " " + bracket
	}
	return logQuery + bracket
}

func aggregationGroupLabels(agg *aggregationHint) []string {
	if agg == nil {
		return nil
	}
	var grouping []string
	for _, g := range agg.GroupBy {
		gl := strings.ToLower(strings.TrimSpace(g))
		if gl == "timestamp" || gl == "time" {
			continue
		}
		if strings.EqualFold(g, agg.Column) {
			continue
		}
		grouping = append(grouping, g)
	}
	sort.Strings(grouping)
	return grouping
}

func innerMetricRangeVector(logQuery string, sqlFunc string, column string, window time.Duration) (string, error) {
	bracket := logQLRangeBracket(logQuery, window)

	switch strings.ToUpper(strings.TrimSpace(sqlFunc)) {
	case "COUNT":
		return fmt.Sprintf("count_over_time(%s)", bracket), nil
	}

	col := strings.ToLower(strings.TrimSpace(column))
	switch col {
	case "", "*", "line", "value", "count":
		return fmt.Sprintf("count_over_time(%s)", bracket), nil
	case metricColumnBytes:
		return fmt.Sprintf("bytes_over_time(%s)", bracket), nil
	default:
		return "", fmt.Errorf("unsupported aggregation column %q for loki metric pushdown", column)
	}
}

func wrapLogQLAggregate(logqlOp string, grouping []string, inner string) string {
	if len(grouping) == 0 {
		return fmt.Sprintf("%s(%s)", logqlOp, inner)
	}
	return fmt.Sprintf("%s by (%s) (%s)", logqlOp, strings.Join(grouping, ", "), inner)
}

func hintGet(hints map[string]string, upperKey string) string {
	if hints == nil {
		return ""
	}
	if v, ok := hints[upperKey]; ok {
		return strings.TrimSpace(v)
	}
	for k, v := range hints {
		if strings.EqualFold(k, upperKey) {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func buildLogQLPipeline(ctx context.Context, tableLabel, tableValue string, filters []schemas.ColumnFilter, hints sqlHints, dsInfo *datasourceInfo) (string, error) {
	streamLabelSet, err := streamLabelSetForTable(ctx, dsInfo, tableValue)
	if err != nil {
		return "", err
	}

	var streamFilters, pipelineFilters []schemas.ColumnFilter
	for _, f := range filters {
		if shouldSkipFilterColumn(f.Name) || f.Name == tableLabel {
			continue
		}
		if hints.parser != "" {
			if streamLabelSet[f.Name] {
				streamFilters = append(streamFilters, f)
			} else {
				pipelineFilters = append(pipelineFilters, f)
			}
			continue
		}
		if len(streamLabelSet) > 0 && !streamLabelSet[f.Name] {
			for _, cond := range f.Conditions {
				if _, err := filterConditionToLogQL(f.Name, cond); err != nil {
					return "", err
				}
			}
			return "", fmt.Errorf("column %q requires a parser FOR hint with a LogQL parser pipeline, e.g. parser('json'), parser('json | unpack'), or parser('pattern \"<field>\"')", f.Name)
		}
		streamFilters = append(streamFilters, f)
	}

	selector, err := buildLogQLExpr(tableLabel, tableValue, streamFilters)
	if err != nil {
		return "", err
	}
	if hints.parser == "" {
		return selector, nil
	}

	expr := selector + " | " + hints.parser
	for _, f := range pipelineFilters {
		for _, cond := range f.Conditions {
			frag, err := pipelineFilterToLogQL(f.Name, cond)
			if err != nil {
				return "", err
			}
			expr += " | " + frag
		}
	}
	return expr, nil
}

func streamLabelSetForTable(ctx context.Context, dsInfo *datasourceInfo, table string) (map[string]bool, error) {
	if dsInfo == nil || dsInfo.schemaProvider == nil {
		return nil, nil
	}
	labels, err := dsInfo.schemaProvider.LabelNamesForTable(ctx, table)
	if err != nil {
		return nil, err
	}
	set := make(map[string]bool, len(labels))
	for _, l := range labels {
		set[l] = true
	}
	return set, nil
}

func rejectParsedMetricAggregation(ctx context.Context, table string, agg *aggregationHint, hints sqlHints, dsInfo *datasourceInfo) error {
	if agg == nil || hints.parser == "" {
		return nil
	}
	col := strings.ToLower(strings.TrimSpace(agg.Column))
	if col == "" || col == "*" || col == "line" || col == "value" || col == "count" || col == metricColumnBytes {
		return nil
	}
	streamLabelSet, err := streamLabelSetForTable(ctx, dsInfo, table)
	if err != nil {
		return err
	}
	if streamLabelSet[col] || streamLabelSet[agg.Column] {
		return nil
	}
	return fmt.Errorf("aggregation on parsed field %q requires unwrap (not yet supported)", agg.Column)
}

func pipelineFilterToLogQL(name string, cond schemas.FilterCondition) (string, error) {
	switch cond.Operator {
	case schemas.OperatorEquals:
		return fmt.Sprintf("%s = %s", name, strconv.Quote(fmt.Sprintf("%v", cond.Value))), nil
	case schemas.OperatorNotEquals:
		return fmt.Sprintf("%s != %s", name, strconv.Quote(fmt.Sprintf("%v", cond.Value))), nil
	case schemas.OperatorLike:
		pat := fmt.Sprintf("%v", cond.Value)
		return fmt.Sprintf("%s =~ %s", name, strconv.Quote(pat)), nil
	case schemas.OperatorIn:
		if len(cond.Values) == 0 {
			return "", fmt.Errorf("empty IN list for column %q", name)
		}
		re, err := inValuesToRegex(cond.Values)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s =~ %s", name, strconv.Quote(re)), nil
	default:
		return "", fmt.Errorf("unsupported filter operator %q for column %q", cond.Operator, name)
	}
}

// buildLogQLExpr builds a LogQL stream selector for the table row plus label filters.
func buildLogQLExpr(tableLabel, tableValue string, filters []schemas.ColumnFilter) (string, error) {
	var parts []string

	parts = append(parts, fmt.Sprintf("%s=%s", tableLabel, strconv.Quote(tableValue)))

	for _, f := range filters {
		if shouldSkipFilterColumn(f.Name) {
			continue
		}
		if f.Name == tableLabel {
			// Table dimension is fixed by `table`; ignore redundant predicate on the same label.
			continue
		}
		for _, cond := range f.Conditions {
			s, err := filterConditionToLogQL(f.Name, cond)
			if err != nil {
				return "", err
			}
			if s != "" {
				parts = append(parts, s)
			}
		}
	}

	sort.Strings(parts)

	return "{" + strings.Join(parts, ", ") + "}", nil
}

func shouldSkipFilterColumn(name string) bool {
	switch strings.ToLower(name) {
	case "timestamp", "line", "time":
		return true
	default:
		return false
	}
}

func filterConditionToLogQL(name string, cond schemas.FilterCondition) (string, error) {
	switch cond.Operator {
	case schemas.OperatorEquals:
		return fmt.Sprintf("%s=%s", name, strconv.Quote(fmt.Sprintf("%v", cond.Value))), nil
	case schemas.OperatorNotEquals:
		return fmt.Sprintf("%s!=%s", name, strconv.Quote(fmt.Sprintf("%v", cond.Value))), nil
	case schemas.OperatorLike:
		pat := fmt.Sprintf("%v", cond.Value)
		return fmt.Sprintf("%s=~%s", name, strconv.Quote(pat)), nil
	case schemas.OperatorIn:
		if len(cond.Values) == 0 {
			return "", fmt.Errorf("empty IN list for column %q", name)
		}
		re, err := inValuesToRegex(cond.Values)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s=~%s", name, strconv.Quote(re)), nil
	default:
		return "", fmt.Errorf("unsupported filter operator %q for column %q", cond.Operator, name)
	}
}

func inValuesToRegex(values []any) (string, error) {
	parts := make([]string, 0, len(values))
	for _, v := range values {
		s := fmt.Sprintf("%v", v)
		parts = append(parts, regexp.QuoteMeta(s))
	}
	return "^(" + strings.Join(parts, "|") + ")$", nil
}
