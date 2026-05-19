package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
)

var azureSubscriptionIDSuffix = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// normalizeGrafanaSQLRequest translates dsabstraction SQL queries into Azure Monitor metrics JSON.
// sqlErrors maps refId to validation errors for queries that were not converted.
func (s *Service) normalizeGrafanaSQLRequest(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataRequest, map[string]error) {
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
		if !sq.GrafanaSql || sq.Table == "" {
			out = append(out, q)
			continue
		}

		baseTable := stripTableParameterValues(sq.Table)
		ns := convertNamespace(baseTable)

		tp := mergeTableParams(sq.Table, sq.TableParameterValues)
		subRaw := strParam(tp, subscription)
		sub := parseSubscriptionIDFromParameter(subRaw)
		if sub == "" {
			sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: subscription table parameter is required")
			continue
		}

		metricName := strParam(tp, metricName)
		if metricName == "" {
			sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: metric_name table parameter is required")
			continue
		}

		agg := strParam(tp, aggregation)
		if agg == "" {
			sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: aggregation table parameter is required")
			continue
		}

		rg := strParam(tp, resourceGroup)
		rn := strParam(tp, resourceName)
		rgn := strParam(tp, region)
		if rg == "" {
			sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: resourceGroup table parameter is required")
			continue
		}

		qt := azureMonitor
		model := dataquery.NewAzureMonitorQuery()
		model.RefId = q.RefID
		model.QueryType = &qt
		model.Subscription = &sub

		az := dataquery.NewAzureMetricQuery()
		az.MetricNamespace = &ns
		az.MetricName = &metricName
		az.Aggregation = &agg
		if rgn != "" {
			az.Region = &rgn
		}

		var resources []dataquery.AzureMonitorResource
		if rn != "" {
			resources = []dataquery.AzureMonitorResource{{
				Subscription:    &sub,
				ResourceGroup:   &rg,
				ResourceName:    &rn,
				MetricNamespace: &ns,
				Region:          &rgn,
			}}
		} else {
			if rgn == "" {
				sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: region table parameter is required for multi-resource queries (when resourceName is omitted)")
				continue
			}
			dsInfo, err := s.getDataSourceFromPluginReq(ctx, req)
			if err != nil {
				sqlErrors[q.RefID] = fmt.Errorf("azure monitor sql: %w", err)
				continue
			}
			discovered, err := discoverResourcesForAzureMonitorSQL(ctx, dsInfo, sub, rg, ns)
			if err != nil {
				sqlErrors[q.RefID] = err
				continue
			}
			resources = discovered
			for i := range resources {
				resources[i].Region = &rgn
			}
		}
		az.Resources = resources

		if err := applyMetricSQLFilters(az, sq.Filters); err != nil {
			sqlErrors[q.RefID] = err
			continue
		}

		model.AzureMonitor = az

		raw, err := json.Marshal(model)
		if err != nil {
			sqlErrors[q.RefID] = err
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(raw, &payload); err != nil {
			sqlErrors[q.RefID] = err
			continue
		}
		payload["grafanaSql"] = true
		raw, err = json.Marshal(payload)
		if err != nil {
			sqlErrors[q.RefID] = err
			continue
		}

		out = append(out, backend.DataQuery{
			RefID:         q.RefID,
			QueryType:     azureMonitor,
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

// mergeTableParams combines explicit TableParameterValues with suffix segments from the table name.
func mergeTableParams(table string, explicit map[string]any) map[string]any {
	out := make(map[string]any)
	for k, v := range explicit {
		out[k] = v
	}
	parts := strings.SplitN(table, "_", 2)
	if len(parts) < 2 {
		return out
	}

	return out
}

func strParam(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(v))
}

func parseSubscriptionIDFromParameter(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if loc := azureSubscriptionIDSuffix.FindStringIndex(s); loc != nil {
		return strings.ToLower(s[loc[0]:loc[1]])
	}
	return s
}

func applyMetricSQLFilters(az *dataquery.AzureMetricQuery, filters []schemas.ColumnFilter) error {
	for _, f := range filters {
		if f.Name == "" || len(f.Conditions) == 0 {
			continue
		}
		switch f.Name {
		case "dimensions":
			dims, err := dimensionFiltersFromSQL(f.Conditions)
			if err != nil {
				return err
			}
			if len(dims) > 0 {
				az.DimensionFilters = append(az.DimensionFilters, dims...)
			}
		default:
			if dim, ok := decodeDimensionColumnName(f.Name); ok {
				vals := collectFilterStringValues(f.Conditions)
				if len(vals) == 0 {
					continue
				}
				op := "eq"
				opPtr := op
				d := dataquery.AzureMetricDimension{
					Dimension: &dim,
					Operator:  &opPtr,
					Filters:   vals,
				}
				az.DimensionFilters = append(az.DimensionFilters, d)
			}
			// Other columns (time, value) are handled by the query time range / API, not as extra filters in v1.
			continue
		}
	}
	return nil
}

func collectFilterStringValues(conds []schemas.FilterCondition) []string {
	var out []string
	for _, c := range conds {
		if c.Operator == schemas.OperatorIn && len(c.Values) > 0 {
			for _, v := range c.Values {
				s := strings.TrimSpace(fmt.Sprint(v))
				if s != "" {
					out = append(out, s)
				}
			}
			continue
		}
		if c.Value != nil {
			s := strings.TrimSpace(fmt.Sprint(c.Value))
			if s != "" {
				out = append(out, s)
			}
		}
	}
	return out
}

type dimensionFilterJSON struct {
	Dimension string   `json:"dimension"`
	Operator  string   `json:"operator"`
	Filters   []string `json:"filters"`
}

func dimensionFiltersFromSQL(conds []schemas.FilterCondition) ([]dataquery.AzureMetricDimension, error) {
	var out []dataquery.AzureMetricDimension
	for _, c := range conds {
		raw, err := conditionRawJSON(c)
		if err != nil || raw == "" {
			continue
		}
		var entries []dimensionFilterJSON
		if err := json.Unmarshal([]byte(raw), &entries); err != nil {
			// Single object
			var one dimensionFilterJSON
			if err2 := json.Unmarshal([]byte(raw), &one); err2 != nil {
				return nil, fmt.Errorf("dimensions filter: %w", err)
			}
			entries = []dimensionFilterJSON{one}
		}
		for _, e := range entries {
			if e.Dimension == "" {
				continue
			}
			dim := e.Dimension
			op := "eq"
			if e.Operator != "" {
				op = e.Operator
			}
			opPtr := op
			d := dataquery.AzureMetricDimension{
				Dimension: &dim,
				Operator:  &opPtr,
				Filters:   e.Filters,
			}
			out = append(out, d)
		}
	}
	return out, nil
}

func conditionRawJSON(c schemas.FilterCondition) (string, error) {
	switch c.Operator {
	case schemas.OperatorEquals, schemas.OperatorIn:
		if c.Value != nil {
			return fmt.Sprint(c.Value), nil
		}
	default:
		if c.Value != nil {
			return fmt.Sprint(c.Value), nil
		}
	}
	return "", nil
}
