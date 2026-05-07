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
// that are not on schemas.Query (same pattern as grafana-prometheus-datasource/pkg/promlib).
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

// normalizeGrafanaSQLRequest rewrites schemads tabular queries into native Loki queries.
// Queries without GrafanaSql=true are unchanged.
//
// sqlErrors maps refId to conversion errors for Grafana SQL queries that could not be rewritten;
// those queries are omitted from the returned request (callers attach sqlErrors to the response).
//
// TableHintValues (keys are uppercase per schemads):
//
//	Log stream selectors always use Loki's range API (/query_range); the instant API does not support log queries.
//	STEP('30s')      — range query step / resolution (must parse as a Grafana duration; invalid values fail the query)
//	DIRECTION('forward'|'backward')
//	RATE('5m')       — parseable Grafana duration; wraps metric expr with rate() or bytes_rate() (see buildGrafanaSQLMetricExpr)
//	INSTANT          — metric queries only: use Loki's instant API (/query) instead of query_range (invalid with pure log selectors)
//
// Row count uses schemas.Query.limit (SQL LIMIT pushdown), not a table hint.
//
// When `aggregation` is present (dsabstraction pushdown), the query is compiled to LogQL metric expressions
// (range API only); responses are flattened with flattenMetricsToTabular instead of log flattening.
//
// dsAbstractionSQLRewriteEnabled runs Grafana SQL normalization when dsAbstractionApp is enabled on
// PluginContext.GrafanaConfig (from plugin request config, including stack toggles forwarded by the query API).
func dsAbstractionSQLRewriteEnabled(req *backend.QueryDataRequest) bool {
	if req == nil {
		return false
	}
	gc := req.PluginContext.GrafanaConfig
	if gc == nil {
		return false
	}
	return gc.FeatureToggles().IsEnabled(flagDsAbstractionApp)
}

// logSQLRefIDs and metricSQLRefIDs partition successful Grafana SQL rewrites so callers can
// choose flattenLogsToTabular vs flattenMetricsToTabular.
func normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo) (*backend.QueryDataRequest, map[string]struct{}, map[string]struct{}, map[string]error) {
	if req == nil || len(req.Queries) == 0 {
		return req, nil, nil, nil
	}

	if !dsAbstractionSQLRewriteEnabled(req) {
		return req, nil, nil, nil
	}

	out := make([]backend.DataQuery, 0, len(req.Queries))
	logSQLRefIDs := make(map[string]struct{})
	metricSQLRefIDs := make(map[string]struct{})
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
			if dsInfo == nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: data source instance has no schema provider")
				continue
			}
			if dsInfo.schemaProvider != nil {
				tableLabel = dsInfo.schemaProvider.ResolveSchemaTableLabel(ctx)
			} else {
				tableLabel = defaultSchemaTableLabel
			}
		}

		hints := sq.TableHintValues
		if hints == nil {
			hints = map[string]string{}
		}

		selector, err := buildLogQLExpr(tableLabel, sq.Table, sq.Filters)
		if err != nil {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to build LogQL: %w", err)
			continue
		}

		stepStr := hintGet(hints, "STEP")
		dirStr := strings.ToLower(hintGet(hints, "DIRECTION"))

		stepForModel := ""
		var stepDur time.Duration
		if stepStr != "" {
			var perr error
			stepDur, perr = gtime.ParseIntervalStringToTimeDuration(stepStr)
			if perr != nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to parse STEP hint %q: %w", stepStr, perr)
				continue
			}
			stepForModel = stepStr
		}

		rateStr := hintGet(hints, "RATE")
		var rateDur time.Duration
		if rateStr != "" {
			var rerr error
			rateDur, rerr = gtime.ParseIntervalStringToTimeDuration(rateStr)
			if rerr != nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to parse RATE hint %q: %w", rateStr, rerr)
				continue
			}
		}

		isMetric := sq.Aggregation != nil || rateStr != ""
		instantOn := instantHintEnabled(hints)

		if instantOn && !isMetric {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: INSTANT hint requires a metric query (aggregation or RATE)")
			continue
		}

		var expr string
		if !isMetric {
			expr = selector
		} else {
			win := metricRangeWindow(stepDur, q.TimeRange.Duration())
			var berr error
			expr, berr = buildGrafanaSQLMetricExpr(selector, sq.Aggregation, win, rateDur)
			if berr != nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: %w", berr)
				continue
			}
			if !instantOn && stepForModel == "" && stepDur == 0 {
				if rateStr != "" {
					stepDur = rateDur
					stepForModel = gtime.FormatInterval(rateDur)
				} else {
					stepDur = win
					stepForModel = gtime.FormatInterval(win)
				}
			}
		}

		qt := "range"
		if isMetric && instantOn {
			qt = "instant"
		}

		if stepForModel != "" && stepDur > 0 {
			q.Interval = stepDur
			q.MaxDataPoints = int64(q.TimeRange.Duration() / stepDur)
			if q.MaxDataPoints < 1 {
				q.MaxDataPoints = 1
			}
		}

		if isMetric && instantOn {
			stepForModel = ""
		}

		maxLines := int64(0)
		if !isMetric && sq.Limit != nil && *sq.Limit > 0 {
			maxLines = *sq.Limit
		}

		model := QueryJSONModel{
			LokiDataQuery: dataqueryFromExpr(q.RefID, expr, qt, maxLines, stepForModel),
			Direction:     directionPtr(dirStr),
		}
		if isMetric {
			model.Direction = nil
		}

		raw, err := json.Marshal(model)
		if err != nil {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: marshal query model: %w", err)
			continue
		}

		q.JSON = raw
		out = append(out, q)
		if isMetric {
			metricSQLRefIDs[q.RefID] = struct{}{}
		} else {
			logSQLRefIDs[q.RefID] = struct{}{}
		}
	}

	req.Queries = out
	return req, logSQLRefIDs, metricSQLRefIDs, sqlErrors
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
	case "forward":
		s := "forward"
		return &s
	case "backward":
		s := "backward"
		return &s
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
		if strings.EqualFold(k, "INSTANT") {
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
	case "COUNT":
		return wrapLogQLAggregate("sum", grouping, inner), nil
	case "SUM":
		return wrapLogQLAggregate("sum", grouping, inner), nil
	case "AVG":
		return wrapLogQLAggregate("avg", grouping, inner), nil
	case "MIN":
		return wrapLogQLAggregate("min", grouping, inner), nil
	case "MAX":
		return wrapLogQLAggregate("max", grouping, inner), nil
	default:
		return "", fmt.Errorf("unsupported aggregation function %q", agg.Function)
	}
}

func wrapLogQLRate(selector string, column string, d time.Duration) string {
	w := gtime.FormatInterval(d)
	bracket := "[" + w + "]"
	col := strings.ToLower(strings.TrimSpace(column))
	if col == "bytes" {
		return fmt.Sprintf("bytes_rate(%s%s)", selector, bracket)
	}
	return fmt.Sprintf("rate(%s%s)", selector, bracket)
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

func innerMetricRangeVector(selector string, sqlFunc string, column string, window time.Duration) (string, error) {
	w := gtime.FormatInterval(window)
	bracket := "[" + w + "]"

	switch strings.ToUpper(strings.TrimSpace(sqlFunc)) {
	case "COUNT":
		return fmt.Sprintf("count_over_time(%s%s)", selector, bracket), nil
	}

	col := strings.ToLower(strings.TrimSpace(column))
	switch col {
	case "", "*", "line", "value", "count":
		return fmt.Sprintf("count_over_time(%s%s)", selector, bracket), nil
	case "bytes":
		return fmt.Sprintf("bytes_over_time(%s%s)", selector, bracket), nil
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
