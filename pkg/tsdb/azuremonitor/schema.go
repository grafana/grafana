package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

const (
	// metricNamespacesListAPIVersion matches public/app/plugins/datasource/azuremonitor/azure_monitor/azure_monitor_datasource.ts (apiPreviewVersion).
	metricNamespacesListAPIVersion = "2017-12-01-preview"
	metricDefinitionsAPIVersion    = "2018-01-01"
	subscription                   = "subscription"
	metricName                     = "metric_name"
	resourceGroup                  = "resourceGroup"
	region                         = "region"
	resourceName                   = "resourceName"
)

// metricsSchema implements schemads schema handlers for Azure Monitor metrics.
type metricsSchema struct {
	s      *Service
	logger log.Logger
}

func newMetricsSchema(s *Service, logger log.Logger) *metricsSchema {
	return &metricsSchema{s: s, logger: logger}
}

func (p *metricsSchema) dsInfo(ctx context.Context) (types.DatasourceInfo, error) {
	pc := backend.PluginConfigFromContext(ctx)
	i, err := p.s.im.Get(ctx, pc)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	dsInfo, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("invalid datasource instance type")
	}
	return dsInfo, nil
}

func metricsTableParameters() []schemas.TableParameter {
	return []schemas.TableParameter{
		{Name: subscription, Root: true, Required: true},
		{Name: metricName, DependsOn: []string{subscription}, Required: true},
		{Name: resourceGroup, DependsOn: []string{subscription}, Required: false},
		{Name: region, DependsOn: []string{subscription}, Required: false},
		{Name: resourceName, DependsOn: []string{subscription, resourceGroup, region}, Required: false},
	}
}

func metricsColumns() []schemas.Column {
	timeOps := []schemas.Operator{
		schemas.OperatorGreaterThan,
		schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan,
		schemas.OperatorLessThanOrEqual,
	}
	eqOps := []schemas.Operator{schemas.OperatorEquals, schemas.OperatorIn}
	return []schemas.Column{
		{Name: "time", Type: schemas.ColumnTypeDatetime, Operators: timeOps, Description: "Metric sample time (aligned with query time range and grain)."},
		{Name: "value", Type: schemas.ColumnTypeFloat64, Description: "Metric value for the selected aggregation."},
		{Name: "aggregation", Type: schemas.ColumnTypeString, Operators: eqOps, Description: "Optional aggregation override (e.g. Average, Total)."},
		{Name: "dimensions", Type: schemas.ColumnTypeJSON, Description: `Optional dimension filters as JSON array: [{"dimension":"DimName","operator":"eq","filters":["v1"]}]`},
	}
}

func normalizeMetricNamespaceTableName(ns string) string {
	s := strings.ToLower(strings.TrimSpace(ns))
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, "/", "-")
	return s
}

// Schema implements schemas.SchemaHandler.
func (p *metricsSchema) Schema(ctx context.Context, _ *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	tables, err := p.discoverMetricNamespaceTables(ctx, dsInfo)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	subValues, subErr := listSubscriptionParameterValues(ctx, dsInfo)
	if subErr != nil {
		p.logger.Warn("failed to list subscriptions for schema", "error", subErr)
	}

	var tableParamValues map[string]map[string][]string
	if len(subValues) > 0 && len(tables) > 0 {
		tableParamValues = make(map[string]map[string][]string)
		for _, t := range tables {
			tableParamValues[t.Name] = map[string][]string{
				subscription: subValues,
			}
		}
	}

	return &schemas.SchemaResponse{FullSchema: &schemas.Schema{
		Tables:               tables,
		TableParameterValues: tableParamValues,
	}}, nil
}

// Tables implements schemas.TablesHandler.
func (p *metricsSchema) Tables(ctx context.Context, _ *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.TablesResponse{Errors: map[string]string{"": err.Error()}}, nil
	}
	tables, err := p.discoverMetricNamespaceTables(ctx, dsInfo)
	if err != nil {
		return &schemas.TablesResponse{Errors: map[string]string{"": err.Error()}}, nil
	}

	names := make([]string, len(tables))
	tps := make(map[string][]schemas.TableParameter)
	for i, t := range tables {
		names[i] = t.Name
		tps[t.Name] = t.TableParameters
	}
	return &schemas.TablesResponse{Tables: names, TableParameters: tps}, nil
}

// Columns implements schemas.ColumnsHandler.
func (p *metricsSchema) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	cols := make(map[string][]schemas.Column, len(req.Tables))
	dsInfo, dsErr := p.dsInfo(ctx)
	for _, name := range req.Tables {
		if dsErr == nil && req.TableParameters != nil {
			cols[name] = p.metricsColumnsEnriched(ctx, dsInfo, name, req.TableParameters)
			continue
		}
		cols[name] = metricsColumns()
	}
	return &schemas.ColumnsResponse{Columns: cols}, nil
}

// TableParameterValues implements schemas.TableParameterValuesHandler.
func (p *metricsSchema) TableParameterValues(ctx context.Context, req *schemas.TableParameterValuesRequest) (*schemas.TableParametersValuesResponse, error) {
	out := make(map[string][]string)
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.TableParametersValuesResponse{TableParameterValues: out, Errors: map[string]string{"": err.Error()}}, nil
	}

	switch req.TableParameter {
	case subscription:
		vals, err := listSubscriptionParameterValues(ctx, dsInfo)
		if err != nil {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out, Errors: map[string]string{"": err.Error()}}, nil
		}
		out[req.TableParameter] = vals
	case metricName:
		subRaw := req.DependencyValues[subscription]
		sub := parseSubscriptionIDFromParameter(subRaw)
		if sub == "" {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}
		ns := fallbackDenormalizeNamespace(stripTableParameterValues(req.Table))
		names, err := listMetricNamesForTable(ctx, dsInfo, sub, ns, req.DependencyValues)
		if err != nil {
			p.logger.Warn("failed to list metric names", "error", err)
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}
		out[req.TableParameter] = names
	default:
		// Optional scoping parameters: not enumerated in v1 (return empty).
		return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
	}

	return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
}

func (p *metricsSchema) discoverMetricNamespaceTables(ctx context.Context, dsInfo types.DatasourceInfo) ([]schemas.Table, error) {
	sub, err := utils.GetFirstSubscriptionOrDefault(ctx, dsInfo, p.logger)
	if err != nil {
		return nil, err
	}

	return fetchSubscriptionMetricNamespaces(ctx, dsInfo, sub)
}

// fetchSubscriptionMetricNamespaces calls the same subscription-level metricNamespaces API as the
// Azure Monitor plugin frontend (Datasource.getMetricNamespaces → AzureMonitorDatasource.getMetricNamespaces
// with resourceUri /subscriptions/{id} and region=global). See url_builder.ts buildAzureMonitorGetMetricNamespacesUrl.
func fetchSubscriptionMetricNamespaces(ctx context.Context, dsInfo types.DatasourceInfo, subscription string) ([]schemas.Table, error) {
	base := strings.TrimSuffix(dsInfo.Routes[azureMonitor].URL, "/")
	reqURL := fmt.Sprintf(
		"%s/subscriptions/%s/providers/microsoft.insights/metricNamespaces?api-version=%s&region=global",
		base,
		subscription,
		metricNamespacesListAPIVersion,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
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
		return nil, fmt.Errorf("metric namespaces request failed: %s: %s", res.Status, string(b))
	}

	var parsed struct {
		Value []struct {
			Properties struct {
				MetricNamespaceName string `json:"metricNamespaceName"`
			} `json:"properties"`
		} `json:"value"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}

	var tables []schemas.Table
	seen := make(map[string]struct{})

	for _, v := range parsed.Value {
		name := strings.TrimSpace(v.Properties.MetricNamespaceName)
		if name == "" {
			continue
		}
		key := normalizeMetricNamespaceTableName(name)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}

		tables = append(tables, schemas.Table{
			Name:            key,
			TableParameters: metricsTableParameters(),
			Columns:         metricsColumns(),
		})
	}

	sort.Slice(tables, func(i, j int) bool { return tables[i].Name < tables[j].Name })

	return tables, nil
}

func runResourceGraphQuery(ctx context.Context, dsInfo types.DatasourceInfo, subscription, kql string) (types.AzureResponseTable, error) {
	base := dsInfo.Routes[azureResourceGraph].URL
	u, err := url.Parse(base)
	if err != nil {
		return types.AzureResponseTable{}, err
	}
	u.Path = path.Join(u.Path, "/providers/Microsoft.ResourceGraph/resources")
	q := u.Query()
	q.Set("api-version", resourcegraph.ArgAPIVersion)
	u.RawQuery = q.Encode()

	body, err := json.Marshal(map[string]any{
		"subscriptions": []string{subscription},
		"query":         kql,
		"options":       map[string]string{"resultFormat": "table"},
	})
	if err != nil {
		return types.AzureResponseTable{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(string(body)))
	if err != nil {
		return types.AzureResponseTable{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	cli := dsInfo.Services[azureResourceGraph].HTTPClient
	res, err := cli.Do(req)
	if err != nil {
		return types.AzureResponseTable{}, backend.DownstreamError(err)
	}
	defer func() {
		_ = res.Body.Close()
	}()

	b, err := io.ReadAll(res.Body)
	if err != nil {
		return types.AzureResponseTable{}, err
	}
	if res.StatusCode/100 != 2 {
		return types.AzureResponseTable{}, fmt.Errorf("resource graph query failed: %s: %s", res.Status, string(b))
	}

	var wrap struct {
		Data types.AzureResponseTable `json:"data"`
	}
	if err := json.Unmarshal(b, &wrap); err != nil {
		return types.AzureResponseTable{}, err
	}
	return wrap.Data, nil
}

type subscriptionListValue struct {
	SubscriptionID string `json:"subscriptionId"`
	DisplayName    string `json:"displayName"`
}

func listSubscriptionParameterValues(ctx context.Context, dsInfo types.DatasourceInfo) ([]string, error) {
	monitorURL := dsInfo.Routes[azureMonitor].URL
	reqURL := fmt.Sprintf("%s/subscriptions?api-version=%s", monitorURL, utils.SubscriptionsApiVersion)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
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
		return nil, fmt.Errorf("list subscriptions failed: %s: %s", res.Status, string(b))
	}
	var parsed struct {
		Value []subscriptionListValue `json:"value"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(parsed.Value))
	for _, v := range parsed.Value {
		if v.SubscriptionID == "" {
			continue
		}
		label := v.SubscriptionID
		if v.DisplayName != "" {
			label = fmt.Sprintf("%s — %s", v.DisplayName, v.SubscriptionID)
		}
		out = append(out, label)
	}
	return out, nil
}

func listMetricNamesForTable(ctx context.Context, dsInfo types.DatasourceInfo, subscription, namespace string, deps map[string]string) ([]string, error) {
	sub := parseSubscriptionIDFromParameter(subscription)
	if sub == "" {
		return nil, nil
	}
	// Prefer a concrete resource when resourceGroup and resourceName are present.
	rg := deps[resourceGroup]
	rn := deps[resourceName]
	region := deps[region]

	if rg != "" && rn != "" {
		return fetchMetricNamesForResource(ctx, dsInfo, sub, namespace, rg, rn, region)
	}

	// Otherwise pick the first resource of this ARM type in the subscription.
	escaped := strings.ReplaceAll(namespace, `'`, `\'`)
	kql := fmt.Sprintf("Resources | where type =~ '%s' | project name, resourceGroup, location | limit 1", escaped)
	tbl, err := runResourceGraphQuery(ctx, dsInfo, sub, kql)
	if err != nil {
		return nil, err
	}
	nameCol, rgCol, locCol := -1, -1, -1
	for i, c := range tbl.Columns {
		switch strings.ToLower(c.Name) {
		case "name":
			nameCol = i
		case "resourcegroup":
			rgCol = i
		case "location":
			locCol = i
		}
	}
	if nameCol < 0 || rgCol < 0 || len(tbl.Rows) == 0 {
		return nil, nil
	}
	row := tbl.Rows[0]
	name, _ := row[nameCol].(string)
	rgVal, _ := row[rgCol].(string)
	loc := ""
	if locCol >= 0 && locCol < len(row) {
		loc, _ = row[locCol].(string)
	}
	if region == "" {
		region = loc
	}
	return fetchMetricNamesForResource(ctx, dsInfo, sub, namespace, rgVal, name, region)
}

func fetchMetricNamesForResource(ctx context.Context, dsInfo types.DatasourceInfo, subscription, namespace, resourceGroup, resourceName, region string) ([]string, error) {
	uri, err := metrics.BuildResourceURIString(subscription, resourceGroup, namespace, resourceName)
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
		Value []struct {
			Name struct {
				Value string `json:"value"`
			} `json:"name"`
		} `json:"value"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}
	names := make([]string, 0, len(parsed.Value))
	seen := make(map[string]struct{})
	for _, v := range parsed.Value {
		n := strings.TrimSpace(v.Name.Value)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		names = append(names, n)
	}
	sort.Strings(names)
	return names, nil
}

func fallbackDenormalizeNamespace(tableBase string) string {
	return strings.ReplaceAll(tableBase, "-", "/")
}

// stripTableParameterValues returns the table name before the first '_' suffix (schemads convention).
func stripTableParameterValues(name string) string {
	if i := strings.IndexByte(name, '_'); i >= 0 {
		return name[:i]
	}
	return name
}
