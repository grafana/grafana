package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	schemas "github.com/grafana/schemads"
)

// Fixed context strings for scalarToString errors: identify the conversion step without echoing
// user query text, tag names, or other payload content (PII-safe for logs and API errors).
const (
	scalarConvCtxLikePattern       = "converting LIKE pattern"
	scalarConvCtxMultiValueOperand = "converting multi-value match operand"
)

// normalizeGrafanaSQLRequest translates dsabstraction Grafana SQL payloads into Tempo queries.
//
// Normalized span-table queries use queryType "traceql" (not "traceqlSearch"): runTraceQlQuery routes
// metrics vs search via isMetricsQuery(query), not via queryType. tableType "spans" is still required
// so Search() selects span frames instead of defaulting to traces.
// sqlErrors maps refId to validation or conversion errors for queries that were not converted.
func (s *Service) normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataRequest, map[string]error) {
	_ = ctx
	if req == nil || len(req.Queries) == 0 {
		return req, nil
	}

	grafanaConfig := req.PluginContext.GrafanaConfig
	if grafanaConfig == nil || !grafanaConfig.FeatureToggles().IsEnabled("dsAbstractionApp") {
		return req, nil
	}

	out := make([]backend.DataQuery, 0, len(req.Queries))
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

		table := strings.TrimSpace(sq.Table)
		if table == "" {
			sqlErrors[q.RefID] = fmt.Errorf("tempo grafana sql: table is required when grafanaSql is true")
			continue
		}

		if table != tempoSchemadsTableSpans {
			sqlErrors[q.RefID] = fmt.Errorf("tempo grafana sql: unsupported table %q (only %q is supported)", table, tempoSchemadsTableSpans)
			continue
		}

		traceQL, err := traceQLFromSchemadsFilters(sq.Filters)
		if err != nil {
			sqlErrors[q.RefID] = err
			continue
		}

		model := dataquery.NewTempoQuery()
		model.RefId = q.RefID
		qt := string(dataquery.TempoQueryTypeTraceql)
		model.QueryType = &qt
		model.Query = &traceQL
		tt := dataquery.SearchTableTypeSpans
		model.TableType = &tt
		if sq.Limit != nil && *sq.Limit > 0 {
			model.Limit = sq.Limit
		}

		raw, err := json.Marshal(model)
		if err != nil {
			sqlErrors[q.RefID] = err
			continue
		}

		out = append(out, backend.DataQuery{
			RefID:         q.RefID,
			QueryType:     string(dataquery.TempoQueryTypeTraceql),
			TimeRange:     q.TimeRange,
			Interval:      q.Interval,
			MaxDataPoints: q.MaxDataPoints,
			JSON:          raw,
		})
	}

	if len(sqlErrors) == 0 {
		sqlErrors = nil
	}
	return &backend.QueryDataRequest{
		PluginContext: req.PluginContext,
		Headers:       req.Headers,
		Queries:       out,
	}, sqlErrors
}

// traceQLFromSchemadsFilters builds a TraceQL span-search selector `{...}` from schemads column filters.
func traceQLFromSchemadsFilters(filters []schemas.ColumnFilter) (string, error) {
	var parts []string
	for _, cf := range filters {
		if cf.Name == "" || len(cf.Conditions) == 0 {
			continue
		}
		sel, err := traceqlSelectorFromSpansColumn(cf.Name)
		if err != nil {
			return "", err
		}
		for _, cond := range cf.Conditions {
			clauses, err := filterConditionToTraceQL(sel, cond)
			if err != nil {
				return "", err
			}
			parts = append(parts, clauses...)
		}
	}
	if len(parts) == 0 {
		return "{}", nil
	}
	return "{" + strings.Join(parts, " && ") + "}", nil
}

// bareTraceQLSearchIntrinsics are span-search attributes that use no scope prefix and no leading dot.
var bareTraceQLSearchIntrinsics = map[string]struct{}{
	"duration":           {},
	"kind":               {},
	"name":               {},
	"rootName":           {},
	"rootServiceName":    {},
	"status":             {},
	"statusMessage":      {},
	"traceDuration":      {},
	"trace:id":           {},
	"span:id":            {},
	"span:name":          {},
	"span:duration":      {},
	"span:kind":          {},
	"span:status":        {},
	"span:statusMessage": {},
}

func traceqlSelectorFromSpansColumn(col string) (string, error) {
	switch col {
	case tempoSpanColTraceIDHidden:
		return "trace:id", nil
	case tempoSpanColTraceService:
		return "rootServiceName", nil
	case tempoSpanColTraceName:
		return "rootName", nil
	case tempoSpanColSpanID:
		return "span:id", nil
	case tempoSpanColTime:
		return "", fmt.Errorf("tempo grafana sql: filtering on column %q is not supported; use the query time range", col)
	case tempoSpanColName:
		return "name", nil
	case tempoSpanColDuration:
		return "duration", nil
	default:
		if strings.HasPrefix(col, "resource.") || strings.HasPrefix(col, "span.") ||
			strings.HasPrefix(col, "event.") || strings.HasPrefix(col, "instrumentation.") ||
			strings.HasPrefix(col, "link.") {
			return col, nil
		}
		if _, ok := bareTraceQLSearchIntrinsics[col]; ok {
			return col, nil
		}
		// Unscoped / unknown tag: leading-dot form matches TempoLanguageProvider for non-intrinsic tags.
		return "." + col, nil
	}
}

func filterConditionToTraceQL(selector string, fc schemas.FilterCondition) ([]string, error) {
	op := fc.Operator
	switch op {
	case schemas.OperatorEquals, schemas.OperatorNotEquals, schemas.OperatorGreaterThan, schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan, schemas.OperatorLessThanOrEqual, schemas.OperatorLike, schemas.OperatorIn:
	default:
		return nil, fmt.Errorf("tempo grafana sql: unsupported operator %q", op)
	}

	if op == schemas.OperatorIn {
		if len(fc.Values) == 0 {
			return nil, fmt.Errorf("tempo grafana sql: %q operator requires values", op)
		}
		return []string{inConditionToTraceQL(selector, fc.Values)}, nil
	}

	if len(fc.Values) > 0 && op != schemas.OperatorLike {
		if len(fc.Values) == 1 {
			return []string{selector + string(op) + formatTraceQLOperand(fc.Values[0], true)}, nil
		}
		return multiValueNonLikeToTraceQL(selector, op, fc.Values)
	}

	if fc.Value == nil {
		return nil, fmt.Errorf("tempo grafana sql: missing value for condition on %q", selector)
	}

	if op == schemas.OperatorLike {
		s, err := scalarToString(fc.Value, scalarConvCtxLikePattern)
		if err != nil {
			return nil, err
		}
		re := likePatternToRegex(s)
		return []string{fmt.Sprintf("%s=~%q", selector, re)}, nil
	}

	return []string{selector + string(op) + formatTraceQLOperand(fc.Value, true)}, nil
}

func inConditionToTraceQL(selector string, values []any) string {
	parts := make([]string, 0, len(values))
	for _, v := range values {
		parts = append(parts, selector+"="+formatTraceQLOperand(v, true))
	}
	return "(" + strings.Join(parts, " || ") + ")"
}

func multiValueNonLikeToTraceQL(selector string, op schemas.Operator, values []any) ([]string, error) {
	if len(values) == 0 {
		return nil, fmt.Errorf("tempo grafana sql: empty values")
	}
	if op == schemas.OperatorEquals {
		pipe, err := joinPipeQuotedValues(values)
		if err != nil {
			return nil, err
		}
		return []string{selector + "=" + pipe}, nil
	}
	if op == schemas.OperatorNotEquals {
		out := make([]string, 0, len(values))
		for _, v := range values {
			out = append(out, selector+string(op)+formatTraceQLOperand(v, true))
		}
		return out, nil
	}
	return nil, fmt.Errorf("tempo grafana sql: multiple values not supported for operator %s", op)
}

func joinPipeQuotedValues(values []any) (string, error) {
	ss := make([]string, 0, len(values))
	for _, v := range values {
		s, err := scalarToString(v, scalarConvCtxMultiValueOperand)
		if err != nil {
			return "", err
		}
		ss = append(ss, s)
	}
	return `"` + strings.Join(ss, "|") + `"`, nil
}

func formatTraceQLOperand(v any, inferString bool) string {
	switch t := v.(type) {
	case bool:
		return strconv.FormatBool(t)
	case float64:
		if t == float64(int64(t)) {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case json.Number:
		return t.String()
	case string:
		if inferString && !looksNumeric(t) {
			return strconv.Quote(t)
		}
		return t
	default:
		s := strings.TrimSpace(fmt.Sprint(v))
		if inferString && !looksNumeric(s) {
			return strconv.Quote(s)
		}
		return s
	}
}

func looksNumeric(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	if _, err := strconv.ParseInt(s, 10, 64); err == nil {
		return true
	}
	if _, err := strconv.ParseFloat(s, 64); err == nil {
		return true
	}
	return false
}

func scalarToString(v any, convCtx string) (string, error) {
	if v == nil {
		return "", fmt.Errorf("tempo grafana sql: %s: value is null (expected string, number, or boolean)", convCtx)
	}
	switch t := v.(type) {
	case string:
		return t, nil
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64), nil
	case json.Number:
		return t.String(), nil
	case bool:
		return strconv.FormatBool(t), nil
	default:
		return "", fmt.Errorf("tempo grafana sql: %s: unsupported value type %T (expected string, number, or boolean)", convCtx, v)
	}
}

func likePatternToRegex(like string) string {
	// Minimal SQL LIKE → regexp: % -> .*, _ -> ., escape regex metacharacters in literals.
	// Anchor with ^...$ so the match follows SQL LIKE full-string semantics (not substring).
	var b strings.Builder
	runes := []rune(like)
	for i := 0; i < len(runes); i++ {
		switch runes[i] {
		case '%':
			b.WriteString(".*")
		case '_':
			b.WriteString(".")
		case '\\':
			if i+1 < len(runes) {
				i++
				b.WriteString(regexp.QuoteMeta(string(runes[i])))
			}
		default:
			b.WriteString(regexp.QuoteMeta(string(runes[i])))
		}
	}
	return "^" + b.String() + "$"
}
