package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

const (
	logsTablePrefix       = "logs-"
	logTableParam         = "log_table"
	workspacesAPIVersion  = "2017-04-26-preview"
	logsMetadataAPISelect = "tables"
)

type logAnalyticsSchema struct {
	s      *Service
	logger log.Logger
}

func newLogAnalyticsSchema(s *Service, logger log.Logger) *logAnalyticsSchema {
	return &logAnalyticsSchema{s: s, logger: logger}
}

func (p *logAnalyticsSchema) dsInfo(ctx context.Context) (types.DatasourceInfo, error) {
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

func logsTableParameters() []schemas.TableParameter {
	return []schemas.TableParameter{
		{Name: subscription, Root: true, Required: true},
		{Name: logTableParam, DependsOn: []string{subscription}, Required: true},
	}
}

func normalizeWorkspaceTableName(workspaceName string) string {
	return logsTablePrefix + strings.TrimSpace(workspaceName)
}

func isLogsTable(name string) bool {
	return strings.HasPrefix(name, logsTablePrefix)
}

func workspaceNameFromTable(tableName string) string {
	return strings.TrimPrefix(stripTableParameterValues(tableName), logsTablePrefix)
}

func listWorkspacesForSubscription(ctx context.Context, dsInfo types.DatasourceInfo, sub string) ([]types.LogAnalyticsWorkspaceResponse, error) {
	base := dsInfo.Routes[azureMonitor].URL
	reqURL := fmt.Sprintf("%s/subscriptions/%s/providers/Microsoft.OperationalInsights/workspaces?api-version=%s", base, sub, workspacesAPIVersion)
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
		return nil, fmt.Errorf("list workspaces failed: %s: %s", res.Status, string(b))
	}
	var parsed struct {
		Value []types.LogAnalyticsWorkspaceResponse `json:"value"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil {
		return nil, err
	}
	return parsed.Value, nil
}

func resolveWorkspaceFromTableName(tableName string, workspaces []types.LogAnalyticsWorkspaceResponse) *types.LogAnalyticsWorkspaceResponse {
	target := workspaceNameFromTable(tableName)
	for i := range workspaces {
		if strings.EqualFold(strings.TrimSpace(workspaces[i].Name), target) {
			return &workspaces[i]
		}
	}
	return nil
}

func fetchWorkspaceMetadata(ctx context.Context, dsInfo types.DatasourceInfo, workspaceCustomerID string) (*types.AzureLogAnalyticsMetadata, error) {
	base := dsInfo.Routes[azureLogAnalytics].URL
	reqURL := fmt.Sprintf("%s/v1/workspaces/%s/metadata", base, workspaceCustomerID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Prefer", "metadata-format-v4,exclude-resourcetypes,exclude-customfunctions")
	q := req.URL.Query()
	q.Set("select", logsMetadataAPISelect)
	req.URL.RawQuery = q.Encode()

	res, err := dsInfo.Services[azureLogAnalytics].HTTPClient.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			backend.Logger.Error("Failed to close response body for metadata request", "err", err)
		}
	}()

	encoding := res.Header.Get("Content-Encoding")
	body, err := utils.Decode(encoding, res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read metadata response: %s", err)
	}

	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("workspace metadata request failed: %s: %s", res.Status, string(body))
	}
	var meta types.AzureLogAnalyticsMetadata
	if err := json.Unmarshal(body, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

func mapLAColumnType(laType string) schemas.ColumnType {
	switch strings.ToLower(strings.TrimSpace(laType)) {
	case "datetime":
		return schemas.ColumnTypeDatetime
	case "int":
		return schemas.ColumnTypeInt32
	case "long":
		return schemas.ColumnTypeInt64
	case "real":
		return schemas.ColumnTypeFloat64
	case "bool":
		return schemas.ColumnTypeBoolean
	case "dynamic":
		return schemas.ColumnTypeJSON
	case "decimal":
		return schemas.ColumnTypeDecimal
	default:
		return schemas.ColumnTypeString
	}
}

func operatorsForColumnType(ct schemas.ColumnType) []schemas.Operator {
	switch ct {
	case schemas.ColumnTypeDatetime:
		return []schemas.Operator{
			schemas.OperatorGreaterThan,
			schemas.OperatorGreaterThanOrEqual,
			schemas.OperatorLessThan,
			schemas.OperatorLessThanOrEqual,
			schemas.OperatorEquals,
			schemas.OperatorNotEquals,
		}
	case schemas.ColumnTypeInt32, schemas.ColumnTypeInt64,
		schemas.ColumnTypeFloat32, schemas.ColumnTypeFloat64,
		schemas.ColumnTypeDecimal:
		return []schemas.Operator{
			schemas.OperatorEquals,
			schemas.OperatorNotEquals,
			schemas.OperatorGreaterThan,
			schemas.OperatorGreaterThanOrEqual,
			schemas.OperatorLessThan,
			schemas.OperatorLessThanOrEqual,
		}
	case schemas.ColumnTypeBoolean:
		return []schemas.Operator{schemas.OperatorEquals, schemas.OperatorNotEquals}
	case schemas.ColumnTypeString:
		return []schemas.Operator{
			schemas.OperatorEquals,
			schemas.OperatorNotEquals,
			schemas.OperatorLike,
			schemas.OperatorIn,
		}
	default:
		return nil
	}
}

func metadataTableToColumns(mt types.MetadataTable) []schemas.Column {
	cols := make([]schemas.Column, 0, len(mt.Columns))
	for _, c := range mt.Columns {
		name := strings.TrimSpace(c.Name)
		if name == "" {
			continue
		}
		ct := mapLAColumnType(c.Type)
		cols = append(cols, schemas.Column{
			Name:        name,
			Type:        ct,
			Operators:   operatorsForColumnType(ct),
			Description: c.Description,
		})
	}
	return cols
}

func logsBaseColumns() []schemas.Column {
	return []schemas.Column{
		{
			Name:      "TimeGenerated",
			Type:      schemas.ColumnTypeDatetime,
			Operators: operatorsForColumnType(schemas.ColumnTypeDatetime),
		},
		{
			Name:      "TenantId",
			Type:      schemas.ColumnTypeString,
			Operators: operatorsForColumnType(schemas.ColumnTypeString),
		},
	}
}

func (p *logAnalyticsSchema) Schema(ctx context.Context, _ *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}

	tables, err := p.discoverWorkspaceTables(ctx, dsInfo)
	if err != nil {
		p.logger.Warn("failed to discover log analytics workspaces for schema", "error", err)
		return &schemas.SchemaResponse{FullSchema: &schemas.Schema{}}, nil
	}

	subValues, subErr := listSubscriptionParameterValues(ctx, dsInfo)
	if subErr != nil {
		p.logger.Warn("failed to list subscriptions for logs schema", "error", subErr)
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

func (p *logAnalyticsSchema) Tables(ctx context.Context, _ *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.TablesResponse{Errors: map[string]string{"": err.Error()}}, nil
	}
	tables, err := p.discoverWorkspaceTables(ctx, dsInfo)
	if err != nil {
		p.logger.Warn("failed to discover log analytics workspaces", "error", err)
		return &schemas.TablesResponse{}, nil
	}

	names := make([]string, len(tables))
	tps := make(map[string][]schemas.TableParameter)
	for i, t := range tables {
		names[i] = t.Name
		tps[t.Name] = t.TableParameters
	}
	return &schemas.TablesResponse{Tables: names, TableParameters: tps}, nil
}

func (p *logAnalyticsSchema) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	cols := make(map[string][]schemas.Column, len(req.Tables))
	dsInfo, dsErr := p.dsInfo(ctx)

	logTable := ""
	if req.TableParameters != nil {
		logTable = strings.TrimSpace(req.TableParameters[logTableParam])
	}

	for _, raw := range req.Tables {
		name := stripTableParameterValues(raw)
		if !isLogsTable(name) {
			continue
		}
		if dsErr != nil || logTable == "" {
			cols[name] = logsBaseColumns()
			continue
		}

		sub, err := p.resolveSubscription(ctx, dsInfo, req.TableParameters)
		if err != nil || sub == "" {
			cols[name] = logsBaseColumns()
			continue
		}

		workspaces, err := p.s.getWorkspacesForSubscription(ctx, dsInfo, sub)
		if err != nil || len(workspaces) == 0 {
			cols[name] = logsBaseColumns()
			continue
		}

		ws := resolveWorkspaceFromTableName(name, workspaces)
		if ws == nil {
			cols[name] = logsBaseColumns()
			continue
		}

		meta, err := fetchWorkspaceMetadata(ctx, dsInfo, ws.Properties.CustomerId)
		if err != nil {
			p.logger.Warn("failed to fetch workspace metadata for columns", "error", err)
			cols[name] = logsBaseColumns()
			continue
		}

		found := false
		for _, mt := range meta.Tables {
			if strings.EqualFold(strings.TrimSpace(mt.Name), logTable) {
				cols[name] = metadataTableToColumns(mt)
				found = true
				break
			}
		}
		if !found {
			cols[name] = logsBaseColumns()
		}
	}
	return &schemas.ColumnsResponse{Columns: cols}, nil
}

func (p *logAnalyticsSchema) TableParameterValues(ctx context.Context, req *schemas.TableParameterValuesRequest) (*schemas.TableParametersValuesResponse, error) {
	out := make(map[string][]string)
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.TableParametersValuesResponse{TableParameterValues: out, Errors: map[string]string{"": err.Error()}}, nil
	}

	if req.TableParameter == subscription {
		vals, err := listSubscriptionParameterValues(ctx, dsInfo)
		if err != nil {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out, Errors: map[string]string{"": err.Error()}}, nil
		}
		out[req.TableParameter] = vals
		return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
	}

	if req.TableParameter == logTableParam {
		sub, err := p.resolveSubscription(ctx, dsInfo, req.DependencyValues)
		if err != nil || sub == "" {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}

		workspaces, err := p.s.getWorkspacesForSubscription(ctx, dsInfo, sub)
		if err != nil || len(workspaces) == 0 {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}

		ws := resolveWorkspaceFromTableName(req.Table, workspaces)
		if ws == nil {
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}

		meta, err := fetchWorkspaceMetadata(ctx, dsInfo, ws.Properties.CustomerId)
		if err != nil {
			p.logger.Warn("failed to fetch workspace metadata for table params", "error", err)
			return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
		}

		var names []string
		for _, mt := range meta.Tables {
			if !mt.HasData {
				continue
			}
			n := strings.TrimSpace(mt.Name)
			if n != "" {
				names = append(names, n)
			}
		}
		sort.Strings(names)
		out[req.TableParameter] = names
		return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
	}

	return &schemas.TableParametersValuesResponse{TableParameterValues: out}, nil
}

func (p *logAnalyticsSchema) ColumnValues(_ context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	out := make(map[string][]string, len(req.Columns))
	for _, c := range req.Columns {
		out[c] = nil
	}
	return &schemas.ColumnValuesResponse{ColumnValues: out}, nil
}

func (p *logAnalyticsSchema) resolveSubscription(ctx context.Context, dsInfo types.DatasourceInfo, params map[string]string) (string, error) {
	if params != nil {
		if raw, ok := params[subscription]; ok {
			sub := parseSubscriptionIDFromParameter(raw)
			if sub != "" {
				return sub, nil
			}
		}
	}
	return utils.GetFirstSubscriptionOrDefault(ctx, dsInfo, p.logger)
}

func (p *logAnalyticsSchema) discoverWorkspaceTables(ctx context.Context, dsInfo types.DatasourceInfo) ([]schemas.Table, error) {
	sub, err := utils.GetFirstSubscriptionOrDefault(ctx, dsInfo, p.logger)
	if err != nil {
		return nil, err
	}

	workspaces, err := p.s.getWorkspacesForSubscription(ctx, dsInfo, sub)
	if err != nil {
		return nil, err
	}

	tables := make([]schemas.Table, 0, len(workspaces))
	seen := make(map[string]struct{})
	for _, ws := range workspaces {
		name := strings.TrimSpace(ws.Name)
		if name == "" {
			continue
		}
		key := normalizeWorkspaceTableName(name)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}

		tables = append(tables, schemas.Table{
			Name:            key,
			TableParameters: logsTableParameters(),
			Columns:         logsBaseColumns(),
		})
	}

	sort.Slice(tables, func(i, j int) bool { return tables[i].Name < tables[j].Name })
	return tables, nil
}
