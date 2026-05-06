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

// normalizeGrafanaSQLRequest rewrites schemads tabular queries into native Loki queries.
// Queries without GrafanaSql=true are unchanged.
//
// sqlErrors maps refId to conversion errors for Grafana SQL queries that could not be rewritten;
// those queries are omitted from the returned request (callers attach sqlErrors to the response).
//
// TableHintValues (keys are uppercase per schemads):
//
//	INSTANT          — instant query
//	STEP('30s')      — range query step / resolution (must parse as a Grafana duration; invalid values fail the query)
//	LIMIT('5000')    — max log lines (digits only, or use schemas.Query.limit)
//	DIRECTION('forward'|'backward')
func normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo) (*backend.QueryDataRequest, map[string]struct{}, map[string]error) {
	_ = ctx
	if req == nil || len(req.Queries) == 0 {
		return req, nil, nil
	}

	grafanaConfig := req.PluginContext.GrafanaConfig
	if grafanaConfig == nil || !grafanaConfig.FeatureToggles().IsEnabled(flagDsAbstractionApp) {
		return req, nil, nil
	}

	tableLabel := dsInfo.schemaTableLabel

	out := make([]backend.DataQuery, 0, len(req.Queries))
	schemadsRefIDs := make(map[string]struct{})
	sqlErrors := make(map[string]error)

	for _, q := range req.Queries {
		var sq schemas.Query
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

		// Aggregation hints (if present) are ignored here: we fetch raw log rows and let dsabstraction
		// apply aggregates on the tabular result unless/until LogQL metric pushdown is implemented.

		hints := sq.TableHintValues
		if hints == nil {
			hints = map[string]string{}
		}

		expr, err := buildLogQLExpr(tableLabel, sq.Table, sq.Filters)
		if err != nil {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to build LogQL: %w", err)
			continue
		}

		isInstant := hintHasFlag(hints, "INSTANT")
		stepStr := hintGet(hints, "STEP")
		limitStr := hintGet(hints, "LIMIT")
		dirStr := strings.ToLower(hintGet(hints, "DIRECTION"))

		qt := "range"
		if isInstant {
			qt = "instant"
		}

		maxLines := pickMaxLines(sq.Limit, limitStr)

		stepForModel := stepStr
		var stepDur time.Duration
		if stepStr != "" {
			var err error
			stepDur, err = gtime.ParseIntervalStringToTimeDuration(stepStr)
			if err != nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to parse STEP hint %q: %w", stepStr, err)
				continue
			}
		}

		model := QueryJSONModel{
			LokiDataQuery: dataqueryFromExpr(q.RefID, expr, qt, maxLines, stepForModel),
			Direction:     directionPtr(dirStr),
		}

		raw, err := json.Marshal(model)
		if err != nil {
			sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: marshal query model: %w", err)
			continue
		}

		if stepForModel != "" && stepDur > 0 {
			q.Interval = stepDur
			q.MaxDataPoints = int64(q.TimeRange.Duration() / stepDur)
			if q.MaxDataPoints < 1 {
				q.MaxDataPoints = 1
			}
		}

		q.JSON = raw
		out = append(out, q)
		schemadsRefIDs[q.RefID] = struct{}{}
	}

	req.Queries = out
	return req, schemadsRefIDs, sqlErrors
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

func pickMaxLines(limit *int64, hintLimit string) int64 {
	if limit != nil && *limit > 0 {
		return *limit
	}
	if hintLimit == "" {
		return 0
	}
	n, err := strconv.ParseInt(strings.TrimSpace(hintLimit), 10, 64)
	if err != nil || n < 1 {
		return 0
	}
	return n
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

func hintHasFlag(hints map[string]string, upperKey string) bool {
	if hints == nil {
		return false
	}
	if _, ok := hints[upperKey]; ok {
		return true
	}
	for k := range hints {
		if strings.EqualFold(k, upperKey) {
			return true
		}
	}
	return false
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
