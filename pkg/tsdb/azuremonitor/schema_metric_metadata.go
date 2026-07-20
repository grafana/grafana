package azuremonitor

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

const (
	dimensionColumnPrefix     = "dimension_"
	dimensionIdentifierPrefix = "dimension_i_"   // + Azure dimension key when it matches dimensionNamePlain (human-readable)
	dimensionB64Prefix        = "dimension_b64_" // + base64url when the key contains spaces, slashes, etc.
)

// dimensionNamePlain matches Azure dimension keys that are safe to expose as a single SQL-style column suffix.
var dimensionNamePlain = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]*$`)

// metricDefinitionFull is the subset of Azure metric definition JSON used for schema enrichment.
type metricDefinitionFull struct {
	Name struct {
		Value          string `json:"value"`
		LocalizedValue string `json:"localizedValue"`
	} `json:"name"`
	PrimaryAggregationType    string   `json:"primaryAggregationType"`
	SupportedAggregationTypes []string `json:"supportedAggregationTypes"`
	Dimensions                []struct {
		Value          string `json:"value"`
		LocalizedValue string `json:"localizedValue"`
	} `json:"dimensions"`
}

func encodeDimensionColumnName(azureDimensionKey string) string {
	if dimensionNamePlain.MatchString(azureDimensionKey) {
		return dimensionIdentifierPrefix + azureDimensionKey
	}
	return dimensionB64Prefix + base64.RawURLEncoding.EncodeToString([]byte(azureDimensionKey))
}

func decodeDimensionColumnName(column string) (azureDimensionKey string, ok bool) {
	switch {
	case strings.HasPrefix(column, dimensionB64Prefix):
		s := strings.TrimPrefix(column, dimensionB64Prefix)
		b, err := base64.RawURLEncoding.DecodeString(s)
		if err != nil || len(b) == 0 {
			return "", false
		}
		return string(b), true
	case strings.HasPrefix(column, dimensionIdentifierPrefix):
		return strings.TrimPrefix(column, dimensionIdentifierPrefix), true
	case strings.HasPrefix(column, dimensionColumnPrefix):
		// Legacy: dimension_<base64url(dim)> (no i_/b64_ marker).
		suffix := strings.TrimPrefix(column, dimensionColumnPrefix)
		b, err := base64.RawURLEncoding.DecodeString(suffix)
		if err != nil || len(b) == 0 {
			return "", false
		}
		return string(b), true
	default:
		return "", false
	}
}

func findMetricDefinition(defs []metricDefinitionFull, metricName string) *metricDefinitionFull {
	for i := range defs {
		if strings.EqualFold(strings.TrimSpace(defs[i].Name.Value), strings.TrimSpace(metricName)) {
			return &defs[i]
		}
	}
	return nil
}

func aggregationEnumValues(def *metricDefinitionFull) []string {
	seen := make(map[string]struct{})
	for _, a := range def.SupportedAggregationTypes {
		a = strings.TrimSpace(a)
		if a != "" {
			seen[a] = struct{}{}
		}
	}
	primary := strings.TrimSpace(def.PrimaryAggregationType)
	if primary != "" {
		seen[primary] = struct{}{}
	}
	all := make([]string, 0, len(seen))
	for s := range seen {
		all = append(all, s)
	}
	sort.Strings(all)
	if primary == "" {
		return all
	}
	out := make([]string, 0, len(all))
	out = append(out, primary)
	for _, s := range all {
		if s != primary {
			out = append(out, s)
		}
	}
	return out
}

func fetchMetricDefinitionsForResource(ctx context.Context, dsInfo types.DatasourceInfo, subscription, namespace, resourceGroup, resourceName, region string) ([]metricDefinitionFull, error) {
	ub := metrics.UrlBuilder{
		Subscription:    &subscription,
		ResourceGroup:   &resourceGroup,
		MetricNamespace: &namespace,
		ResourceName:    &resourceName,
	}
	uri, err := ub.BuildResourceURI()
	if err != nil {
		return nil, err
	}

	base := dsInfo.Routes[azureMonitor].URL
	u, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	u.Path = strings.TrimSuffix(*uri, "/") + "/providers/microsoft.insights/metricdefinitions"
	q := u.Query()
	q.Set("api-version", metricDefinitionsAPIVersion)
	q.Set("metricnamespace", namespace)
	if region != "" {
		q.Set("region", region)
	}
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := dsInfo.Services[azureMonitor].HTTPClient.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer func() { _ = res.Body.Close() }()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("metric definitions request failed: %s: %s", res.Status, string(b))
	}

	var parsed struct {
		Value []metricDefinitionFull `json:"value"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}
	return parsed.Value, nil
}

func timespanFromAPIData(tr apidata.TimeRange) string {
	fromS := strings.TrimSpace(tr.From)
	toS := strings.TrimSpace(tr.To)
	if fromS == "" || toS == "" {
		now := time.Now().UTC()
		from := now.Add(-24 * time.Hour)
		return fmt.Sprintf("%s/%s", from.Format(time.RFC3339), now.Format(time.RFC3339))
	}
	fromT, err1 := parseFlexibleTime(fromS)
	toT, err2 := parseFlexibleTime(toS)
	if err1 != nil || err2 != nil {
		now := time.Now().UTC()
		from := now.Add(-24 * time.Hour)
		return fmt.Sprintf("%s/%s", from.Format(time.RFC3339), now.Format(time.RFC3339))
	}
	return fmt.Sprintf("%s/%s", fromT.UTC().Format(time.RFC3339), toT.UTC().Format(time.RFC3339))
}

func parseFlexibleTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty time")
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if ms, err := strconv.ParseInt(s, 10, 64); err == nil {
		return time.UnixMilli(ms), nil
	}
	return time.Time{}, fmt.Errorf("unsupported time format: %q", s)
}

// fetchDimensionValuesMetadata calls the Azure Monitor metrics API with resultType=metadata and collects
// distinct values for the given dimension name.
func fetchDimensionValuesMetadata(ctx context.Context, dsInfo types.DatasourceInfo, subscription, namespace, resourceGroup, resourceName, region, metricName, dimensionName string, tr apidata.TimeRange) ([]string, error) {
	ub := metrics.UrlBuilder{
		Subscription:    &subscription,
		ResourceGroup:   &resourceGroup,
		MetricNamespace: &namespace,
		ResourceName:    &resourceName,
	}
	uri, err := ub.BuildResourceURI()
	if err != nil {
		return nil, err
	}
	base := dsInfo.Routes[azureMonitor].URL
	u, err := url.Parse(base)
	if err != nil {
		return nil, err
	}
	u.Path = strings.TrimSuffix(*uri, "/") + "/providers/microsoft.insights/metrics"
	q := u.Query()
	q.Set("api-version", metrics.AzureMonitorAPIVersion)
	q.Set("timespan", timespanFromAPIData(tr))
	q.Set("metricnames", metricName)
	q.Set("metricnamespace", namespace)
	q.Set("resultType", "metadata")
	if region != "" {
		q.Set("region", region)
	}
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := dsInfo.Services[azureMonitor].HTTPClient.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer func() { _ = res.Body.Close() }()
	b, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("metrics metadata request failed: %s: %s", res.Status, string(b))
	}

	values, err := parseMetadataDimensionValues(b, dimensionName)
	if err != nil {
		return nil, err
	}
	sort.Strings(values)
	return values, nil
}

func parseMetadataDimensionValues(body []byte, dimensionName string) ([]string, error) {
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return nil, err
	}
	want := strings.TrimSpace(dimensionName)
	seen := make(map[string]struct{})
	var walk func(any)
	walk = func(n any) {
		switch v := n.(type) {
		case map[string]any:
			if mv, ok := v["metadatavalues"]; ok {
				if arr, ok := mv.([]any); ok {
					for _, item := range arr {
						m, ok := item.(map[string]any)
						if !ok {
							continue
						}
						nameObj, ok := m["name"].(map[string]any)
						if !ok {
							continue
						}
						nv, _ := nameObj["value"].(string)
						if !strings.EqualFold(strings.TrimSpace(nv), want) {
							continue
						}
						valStr, _ := m["value"].(string)
						valStr = strings.TrimSpace(valStr)
						if valStr == "" {
							continue
						}
						if _, dup := seen[valStr]; !dup {
							seen[valStr] = struct{}{}
						}
					}
				}
			}
			for _, child := range v {
				walk(child)
			}
		case []any:
			for _, el := range v {
				walk(el)
			}
		}
	}
	walk(root)
	out := make([]string, 0, len(seen))
	for s := range seen {
		out = append(out, s)
	}
	return out, nil
}

// metricsColumnsEnriched returns base metric columns plus per-dimension filter columns when definitions can be resolved.
func (p *metricsSchema) metricsColumnsEnriched(ctx context.Context, dsInfo types.DatasourceInfo, table string, tp map[string]string) []schemas.Column {
	base := metricsColumns()
	if tp == nil {
		return base
	}
	mn := strings.TrimSpace(tp[metricName])
	rg := strings.TrimSpace(tp[resourceGroup])
	rn := strings.TrimSpace(tp[resourceName])
	if mn == "" || rg == "" || rn == "" {
		return base
	}
	sub := parseSubscriptionIDFromParameter(tp[subscription])
	if sub == "" {
		return base
	}
	ns := convertNamespace(stripTableParameterValues(table))
	region := strings.TrimSpace(tp[region])

	defs, err := fetchMetricDefinitionsForResource(ctx, dsInfo, sub, ns, rg, rn, region)
	if err != nil {
		p.logger.Warn("metric definitions for schema columns", "error", err)
		return base
	}
	def := findMetricDefinition(defs, mn)
	if def == nil {
		return base
	}

	eqOps := []schemas.Operator{schemas.OperatorEquals, schemas.OperatorIn}
	cols := make([]schemas.Column, 0, len(base)+len(def.Dimensions))
	cols = append(cols, base...)
	for _, d := range def.Dimensions {
		dimName := strings.TrimSpace(d.Value)
		if dimName == "" {
			continue
		}
		loc := dimName
		if strings.TrimSpace(d.LocalizedValue) != "" {
			loc = d.LocalizedValue
		}
		colName := encodeDimensionColumnName(dimName)
		cols = append(cols, schemas.Column{
			Name:        colName,
			Type:        schemas.ColumnTypeString,
			Operators:   eqOps,
			Description: fmt.Sprintf("Dimension filter: %s (%s).", loc, dimName),
		})
	}
	return cols
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (p *metricsSchema) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	out := make(map[string][]string)
	errs := make(map[string]string)
	for _, c := range req.Columns {
		out[c] = nil
	}

	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.ColumnValuesResponse{ColumnValues: out, Errors: map[string]string{"": err.Error()}}, nil
	}

	tp := req.TableParameters
	if tp == nil {
		return &schemas.ColumnValuesResponse{ColumnValues: out}, nil
	}

	table := stripTableParameterValues(req.Table)
	ns := convertNamespace(table)
	sub := parseSubscriptionIDFromParameter(tp[subscription])
	mn := strings.TrimSpace(tp[metricName])
	rg := strings.TrimSpace(tp[resourceGroup])
	rn := strings.TrimSpace(tp[resourceName])
	region := strings.TrimSpace(tp[region])

	if sub == "" || mn == "" || rg == "" || rn == "" {
		return &schemas.ColumnValuesResponse{ColumnValues: out}, nil
	}

	defs, err := fetchMetricDefinitionsForResource(ctx, dsInfo, sub, ns, rg, rn, region)
	if err != nil {
		return &schemas.ColumnValuesResponse{ColumnValues: out, Errors: map[string]string{"": err.Error()}}, nil
	}
	def := findMetricDefinition(defs, mn)
	if def == nil {
		return &schemas.ColumnValuesResponse{ColumnValues: out}, nil
	}

	for _, col := range req.Columns {
		switch {
		default:
			if dim, ok := decodeDimensionColumnName(col); ok {
				vals, err := fetchDimensionValuesMetadata(ctx, dsInfo, sub, ns, rg, rn, region, mn, dim, req.TimeRange)
				if err != nil {
					p.logger.Warn("dimension column values", "column", col, "error", err)
					errs[col] = err.Error()
					continue
				}
				out[col] = vals
			}
		}
	}

	if len(errs) == 0 {
		errs = nil
	}
	return &schemas.ColumnValuesResponse{ColumnValues: out, Errors: errs}, nil
}
