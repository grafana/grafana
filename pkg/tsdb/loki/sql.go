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
//	Log stream selectors always use Loki's range API (/query_range); the instant API does not support log queries.
//	STEP('30s')      — range query step / resolution (must parse as a Grafana duration; invalid values fail the query)
//	DIRECTION('forward'|'backward')
//
// Row count uses schemas.Query.limit (SQL LIMIT pushdown), not a table hint.
func normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo) (*backend.QueryDataRequest, map[string]struct{}, map[string]error) {
	if req == nil || len(req.Queries) == 0 {
		return req, nil, nil
	}

	grafanaConfig := req.PluginContext.GrafanaConfig
	if grafanaConfig == nil || !grafanaConfig.FeatureToggles().IsEnabled(flagDsAbstractionApp) {
		return req, nil, nil
	}

	out := make([]backend.DataQuery, 0, len(req.Queries))
	schemadsRefIDs := make(map[string]struct{})
	sqlErrors := make(map[string]error)

	var tableLabel string

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

		if tableLabel == "" {
			if dsInfo == nil || dsInfo.schemaProvider == nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: data source instance has no schema provider")
				continue
			}
			tableLabel = dsInfo.schemaProvider.ResolveSchemaTableLabel(ctx)
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

		stepStr := hintGet(hints, "STEP")
		dirStr := strings.ToLower(hintGet(hints, "DIRECTION"))

		qt := "range"

		maxLines := int64(0)
		if sq.Limit != nil && *sq.Limit > 0 {
			maxLines = *sq.Limit
		}

		stepForModel := ""
		var stepDur time.Duration
		if stepStr != "" {
			var err error
			stepDur, err = gtime.ParseIntervalStringToTimeDuration(stepStr)
			if err != nil {
				sqlErrors[q.RefID] = fmt.Errorf("loki grafana sql: failed to parse STEP hint %q: %w", stepStr, err)
				continue
			}
			stepForModel = stepStr
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
