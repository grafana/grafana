package loki

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"sync"
	"time"

	gocache "github.com/patrickmn/go-cache"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	schemas "github.com/grafana/schemads"
	"go.opentelemetry.io/otel/trace"
)

// schemaTableLabelCandidates mirrors Loki's discover_service_name ingestion order.
// See https://grafana.com/docs/loki/latest/get-started/labels/.
var schemaTableLabelCandidates = []string{
	"service_name",
	"service",
	"app",
	"application",
	"name",
	"app_kubernetes_io_name",
	"container",
	"container_name",
	"component",
	"workload",
	"job",
}

const defaultSchemaTableLabel = "service_name"

// schemaTableLabelCacheTTL is how long we reuse the label picked by discoverTableLabel before
// re-querying Loki's /labels API.
const schemaTableLabelCacheTTL = 5 * time.Minute

// schemaCacheKeyTableLabel is the go-cache key for the resolved table label. It uses ASCII unit
// separator (0x1f), which cannot appear in Loki label names, so it cannot collide with parsed-label keys.
const schemaCacheKeyTableLabel = "\x1fgrafana/loki/schema/table-label"

const (
	schemaProbeLimit  = 100
	schemaProbeWindow = 15 * time.Minute
)

var reservedParsedLabels = map[string]struct{}{
	"__error__":          {},
	"__error_details__":  {},
	"__stream_shard__":   {},
}

var schemaBaseColumns = []schemas.Column{
	{
		Name:        "timestamp",
		Type:        schemas.ColumnTypeDatetime,
		Description: "Sample time for each row (log and metric tabular responses).",
	},
	{
		Name:        "line",
		Type:        schemas.ColumnTypeString,
		Description: "Log line text; filled for log queries. Metric (rate/aggregation) tabular frames expose value instead, not line.",
	},
	{
		Name:        "value",
		Type:        schemas.ColumnTypeFloat64,
		Description: "Numeric metric sample; filled for Grafana SQL metric queries (rate and/or aggregation). Log tabular frames expose line instead, not value.",
	},
}

var labelColumnOperators = []schemas.Operator{
	schemas.OperatorEquals,
	schemas.OperatorNotEquals,
	schemas.OperatorIn,
	schemas.OperatorLike,
}

// lokiTableHints lists execution hints supported by Grafana SQL → LogQL normalization
// (see normalizeGrafanaSQLRequest / TableHintValues).
var lokiTableHints = []schemas.TableHint{
	{Name: "step", Description: "Override range query step/resolution, e.g. step('30s').", HasValue: true},
	{Name: "direction", Description: "Log direction: direction('forward') or direction('backward').", HasValue: true},
	{Name: "rate", Description: "Wrap the stream selector with rate() or bytes_rate() over this window, e.g. rate('5m'). Combines with aggregation when set.", HasValue: true},
	{Name: "instant", Description: "Use Loki instant query API for metric expressions (requires aggregation or rate hint).", HasValue: false},
	{
		Name: "parser",
		Description: "LogQL parser pipeline after the stream selector, passed through verbatim: " +
			"parser('json'), parser('json | unpack'), parser('pattern \"<status>\"').",
		HasValue:      true,
		AffectsSchema: true,
	},
}

// lokiDatasourceCapabilities declares what the SQL engine may push to Loki.
var lokiDatasourceCapabilities = &schemas.DatasourceCapabilities{
	Limit: true,
	AggregateFunctions: []schemas.AggregateFunction{
		schemas.AggregateSum,
		schemas.AggregateAvg,
		schemas.AggregateCount,
		schemas.AggregateMin,
		schemas.AggregateMax,
	},
}

type lokiLabelsAPIResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
}

// SchemaProvider implements schemads handlers for Loki (tables = values of the
// resolved table label). Base columns: timestamp, line, value; stream label columns are
// added per table in Columns (see buildColumnsFromLabels).
type SchemaProvider struct {
	httpClient *http.Client
	url        string
	logger     log.Logger
	tracer     trace.Tracer

	// cacheTTL overrides schemaTableLabelCacheTTL when non-zero (tests).
	cacheTTL time.Duration

	cacheOnce   sync.Once
	schemaCache *gocache.Cache
}

func NewSchemaProvider(httpClient *http.Client, url string, logger log.Logger, tracer trace.Tracer) *SchemaProvider {
	return &SchemaProvider{
		httpClient: httpClient,
		url:        url,
		logger:     logger,
		tracer:     tracer,
	}
}

// ResolveSchemaTableLabel resolves the label used to partition SQL tables (e.g. service_name) and
// caches it for schemaTableLabelCacheTTL (see resolvedTableLabel).
func (p *SchemaProvider) ResolveSchemaTableLabel(ctx context.Context) string {
	return p.resolvedTableLabel(ctx)
}

func (p *SchemaProvider) cacheTTLOrDefault() time.Duration {
	if p.cacheTTL > 0 {
		return p.cacheTTL
	}
	return schemaTableLabelCacheTTL
}

func (p *SchemaProvider) schemaCacheOrInit() *gocache.Cache {
	p.cacheOnce.Do(func() {
		ttl := p.cacheTTLOrDefault()
		p.schemaCache = gocache.New(ttl, 2*ttl)
	})
	return p.schemaCache
}

func schemaParsedLabelsCacheKey(tableLabel, table, parser string) string {
	return tableLabel + "\x00" + table + "\x00" + parser
}

// Schema implements schemas.SchemaHandler.
func (p *SchemaProvider) Schema(ctx context.Context, _ *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	names, err := p.fetchTableNames(ctx)
	if err != nil {
		return nil, err
	}
	tables := make([]schemas.Table, len(names))
	for i, name := range names {
		tables[i] = schemas.Table{
			Name:       name,
			Columns:    schemaBaseColumns,
			TableHints: lokiTableHints,
		}
	}
	return &schemas.SchemaResponse{
		FullSchema: &schemas.Schema{
			Tables:       tables,
			Capabilities: lokiDatasourceCapabilities,
		},
	}, nil
}

// Tables implements schemas.TablesHandler.
func (p *SchemaProvider) Tables(ctx context.Context, _ *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	names, err := p.fetchTableNames(ctx)
	if err != nil {
		return nil, err
	}
	tableHints := make(map[string][]schemas.TableHint, len(names))
	for _, name := range names {
		tableHints[name] = lokiTableHints
	}
	return &schemas.TablesResponse{
		Tables:       names,
		TableHints:   tableHints,
		Capabilities: lokiDatasourceCapabilities,
	}, nil
}

// LabelNamesForTable returns stream label names for a table value (Grafana SQL table name).
func (p *SchemaProvider) LabelNamesForTable(ctx context.Context, table string) ([]string, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	return p.fetchLabelNamesForTable(ctx, tblLabel, table)
}

// Columns implements schemas.ColumnsHandler.
func (p *SchemaProvider) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	parserStage, err := parserStageFromSchemaContext(req.SchemaContext)
	if err != nil {
		p.logger.Warn("invalid parser hints for columns", "error", err)
	}
	out := make(map[string][]schemas.Column, len(req.Tables))
	for _, table := range req.Tables {
		labels, err := p.fetchLabelNamesForTable(ctx, tblLabel, table)
		if err != nil {
			p.logger.Warn("failed to fetch labels for table", "table", table, "error", err)
			out[table] = schemaBaseColumns
			continue
		}
		cols := buildColumnsFromLabels(labels, tblLabel)
		if parserStage != "" {
			parsed, err := p.fetchParsedLabelNames(ctx, tblLabel, table, parserStage, labels)
			if err != nil {
				p.logger.Warn("failed to probe parsed columns for table", "table", table, "parserStage", parserStage, "error", err)
			} else {
				cols = appendParsedColumns(cols, parsed)
			}
		}
		out[table] = cols
	}
	return &schemas.ColumnsResponse{Columns: out}, nil
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (p *SchemaProvider) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	parserStage, err := parserStageFromSchemaContext(req.SchemaContext)
	if err != nil {
		p.logger.Warn("invalid parser hints for column values", "error", err)
	}

	var streamSet map[string]struct{}
	if parserStage != "" {
		streamLabels, err := p.fetchLabelNamesForTable(ctx, tblLabel, req.Table)
		if err != nil {
			p.logger.Warn("failed to fetch stream labels for column values", "table", req.Table, "error", err)
		} else {
			streamSet = make(map[string]struct{}, len(streamLabels))
			for _, l := range streamLabels {
				streamSet[l] = struct{}{}
			}
		}
	}

	resp := &schemas.ColumnValuesResponse{
		ColumnValues: make(map[string][]string),
		Errors:       make(map[string]string),
	}
	for _, col := range req.Columns {
		if col == "timestamp" || col == "line" || col == "value" {
			continue
		}
		if parserStage != "" && streamSet != nil {
			if _, isStream := streamSet[col]; !isStream {
				vals, err := p.fetchParsedColumnValues(ctx, tblLabel, req.Table, parserStage, col, req.TimeRange)
				if err != nil {
					resp.Errors[col] = err.Error()
					continue
				}
				resp.ColumnValues[col] = vals
				continue
			}
		}
		vals, err := p.fetchLabelValues(ctx, tblLabel, req.Table, col, req.TimeRange)
		if err != nil {
			resp.Errors[col] = err.Error()
			continue
		}
		resp.ColumnValues[col] = vals
	}
	return resp, nil
}

func (p *SchemaProvider) fetchTableNames(ctx context.Context) ([]string, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	path := fmt.Sprintf("/loki/api/v1/label/%s/values", url.PathEscape(tblLabel))
	return p.fetchLokiStringList(ctx, path, "fetch table names")
}

func (p *SchemaProvider) fetchLabelNamesForTable(ctx context.Context, tableLabel, tableValue string) ([]string, error) {
	params := url.Values{}
	params.Set("query", logQLSelector(tableLabel, tableValue))
	path := "/loki/api/v1/labels?" + params.Encode()
	return p.fetchLokiStringList(ctx, path, "fetch label names")
}

func (p *SchemaProvider) fetchLabelValues(ctx context.Context, tableLabel, tableValue, labelName string, tr apidata.TimeRange) ([]string, error) {
	params := url.Values{}
	params.Set("query", logQLSelector(tableLabel, tableValue))
	appendTimeRangeParams(params, tr)
	path := fmt.Sprintf("/loki/api/v1/label/%s/values?%s", url.PathEscape(labelName), params.Encode())
	return p.fetchLokiStringList(ctx, path, "fetch label values")
}

func (p *SchemaProvider) fetchLokiStringList(ctx context.Context, path, desc string) ([]string, error) {
	api := newLokiAPI(p.httpClient, p.url, p.logger, p.tracer)
	raw, err := api.RawQuery(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", desc, err)
	}
	if raw.Status/100 != 2 {
		return nil, fmt.Errorf("%s: unexpected status %d", desc, raw.Status)
	}
	var parsed lokiLabelsAPIResponse
	if err := json.Unmarshal(raw.Body, &parsed); err != nil {
		return nil, fmt.Errorf("%s: decode: %w", desc, err)
	}
	if parsed.Status != "success" {
		return nil, fmt.Errorf("%s: loki status %q", desc, parsed.Status)
	}
	return parsed.Data, nil
}

func (p *SchemaProvider) resolvedTableLabel(ctx context.Context) string {
	c := p.schemaCacheOrInit()
	if v, ok := c.Get(schemaCacheKeyTableLabel); ok {
		return v.(string)
	}
	label := p.discoverTableLabel(ctx)
	c.Set(schemaCacheKeyTableLabel, label, p.cacheTTLOrDefault())
	return label
}

func (p *SchemaProvider) discoverTableLabel(ctx context.Context) string {
	names, err := p.fetchAllLabelNames(ctx)
	if err != nil {
		p.logger.Debug("failed to list labels for table-label discovery; using default", "error", err, "default", defaultSchemaTableLabel)
		return defaultSchemaTableLabel
	}
	set := make(map[string]struct{}, len(names))
	for _, n := range names {
		set[n] = struct{}{}
	}
	for _, cand := range schemaTableLabelCandidates {
		if _, ok := set[cand]; ok {
			return cand
		}
	}
	return defaultSchemaTableLabel
}

func (p *SchemaProvider) fetchAllLabelNames(ctx context.Context) ([]string, error) {
	return p.fetchLokiStringList(ctx, "/loki/api/v1/labels", "list labels")
}

func parserStageFromSchemaContext(schemaContext map[string]string) (string, error) {
	hints := parserHintsFromSchemaContext(schemaContext)
	if len(hints) == 0 {
		return "", nil
	}
	return buildParserStage(hints)
}

func (p *SchemaProvider) fetchParsedLabelNames(ctx context.Context, tableLabel, table, parserStage string, streamLabels []string) ([]string, error) {
	if parserStage == "" {
		return nil, fmt.Errorf("parser stage is empty")
	}

	cacheKey := schemaParsedLabelsCacheKey(tableLabel, table, parserStage)
	c := p.schemaCacheOrInit()
	if v, ok := c.Get(cacheKey); ok {
		return append([]string(nil), v.([]string)...), nil
	}

	streamSet := make(map[string]struct{}, len(streamLabels))
	for _, l := range streamLabels {
		streamSet[l] = struct{}{}
	}

	keys, err := p.probeParsedLabelKeys(ctx, tableLabel, table, parserStage)
	if err != nil {
		return nil, err
	}

	filtered := make([]string, 0, len(keys))
	for _, k := range keys {
		if k == tableLabel {
			continue
		}
		if _, reserved := reservedParsedLabels[k]; reserved {
			continue
		}
		if _, isStream := streamSet[k]; isStream {
			continue
		}
		filtered = append(filtered, k)
	}
	sort.Strings(filtered)

	c.Set(cacheKey, filtered, p.cacheTTLOrDefault())

	return filtered, nil
}

type lokiStreamsQueryResponse struct {
	Status string `json:"status"`
	Data   struct {
		Result []struct {
			Stream map[string]string `json:"stream"`
		} `json:"result"`
	} `json:"data"`
}

func (p *SchemaProvider) probeParsedLabelKeys(ctx context.Context, tableLabel, table, parserStage string) ([]string, error) {
	query := logQLSelector(tableLabel, table) + " | " + parserStage
	params := url.Values{}
	params.Set("query", query)
	params.Set("limit", strconv.Itoa(schemaProbeLimit))
	end := time.Now().UTC()
	start := end.Add(-schemaProbeWindow)
	params.Set("start", strconv.FormatInt(start.UnixNano(), 10))
	params.Set("end", strconv.FormatInt(end.UnixNano(), 10))

	api := newLokiAPI(p.httpClient, p.url, p.logger, p.tracer)
	raw, err := api.RawQuery(ctx, "/loki/api/v1/query_range?"+params.Encode())
	if err != nil {
		return nil, fmt.Errorf("probe parsed labels: %w", err)
	}
	if raw.Status/100 != 2 {
		return nil, fmt.Errorf("probe parsed labels: unexpected status %d", raw.Status)
	}

	var parsed lokiStreamsQueryResponse
	if err := json.Unmarshal(raw.Body, &parsed); err != nil {
		return nil, fmt.Errorf("probe parsed labels: decode: %w", err)
	}
	if parsed.Status != "success" {
		return nil, fmt.Errorf("probe parsed labels: loki status %q", parsed.Status)
	}

	keysSet := make(map[string]struct{})
	for _, r := range parsed.Data.Result {
		for k := range r.Stream {
			keysSet[k] = struct{}{}
		}
	}
	keys := make([]string, 0, len(keysSet))
	for k := range keysSet {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys, nil
}

func (p *SchemaProvider) fetchParsedColumnValues(ctx context.Context, tableLabel, table, parserStage, column string, tr apidata.TimeRange) ([]string, error) {
	keys, err := p.probeParsedLabelKeys(ctx, tableLabel, table, parserStage)
	if err != nil {
		return nil, err
	}
	keySet := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		keySet[k] = struct{}{}
	}
	if _, ok := keySet[column]; !ok {
		return nil, nil
	}

	query := logQLSelector(tableLabel, table) + " | " + parserStage
	params := url.Values{}
	params.Set("query", query)
	params.Set("limit", strconv.Itoa(schemaProbeLimit))
	appendTimeRangeParams(params, tr)
	if params.Get("start") == "" && params.Get("end") == "" {
		end := time.Now().UTC()
		start := end.Add(-schemaProbeWindow)
		params.Set("start", strconv.FormatInt(start.UnixNano(), 10))
		params.Set("end", strconv.FormatInt(end.UnixNano(), 10))
	}

	api := newLokiAPI(p.httpClient, p.url, p.logger, p.tracer)
	raw, err := api.RawQuery(ctx, "/loki/api/v1/query_range?"+params.Encode())
	if err != nil {
		return nil, fmt.Errorf("probe parsed column values: %w", err)
	}
	if raw.Status/100 != 2 {
		return nil, fmt.Errorf("probe parsed column values: unexpected status %d", raw.Status)
	}

	var parsed lokiStreamsQueryResponse
	if err := json.Unmarshal(raw.Body, &parsed); err != nil {
		return nil, fmt.Errorf("probe parsed column values: decode: %w", err)
	}
	if parsed.Status != "success" {
		return nil, fmt.Errorf("probe parsed column values: loki status %q", parsed.Status)
	}

	valuesSet := make(map[string]struct{})
	for _, r := range parsed.Data.Result {
		if v, ok := r.Stream[column]; ok && v != "" {
			valuesSet[v] = struct{}{}
		}
	}
	values := make([]string, 0, len(valuesSet))
	for v := range valuesSet {
		values = append(values, v)
	}
	sort.Strings(values)
	return values, nil
}

func appendParsedColumns(cols []schemas.Column, parsed []string) []schemas.Column {
	existing := make(map[string]struct{}, len(cols))
	for _, c := range cols {
		existing[c.Name] = struct{}{}
	}
	for _, name := range parsed {
		if _, ok := existing[name]; ok {
			continue
		}
		cols = append(cols, schemas.Column{
			Name:        name,
			Type:        schemas.ColumnTypeString,
			Operators:   labelColumnOperators,
			Description: "Extracted log field (parser hint).",
		})
	}
	return cols
}

func buildColumnsFromLabels(labels []string, tableLabel string) []schemas.Column {
	sort.Strings(labels)
	cols := make([]schemas.Column, 0, len(schemaBaseColumns)+len(labels))
	cols = append(cols, schemaBaseColumns...)
	for _, label := range labels {
		if label == tableLabel {
			continue
		}
		cols = append(cols, schemas.Column{
			Name:      label,
			Type:      schemas.ColumnTypeString,
			Operators: labelColumnOperators,
		})
	}
	return cols
}

func logQLSelector(labelName, value string) string {
	return fmt.Sprintf("{%s=%s}", labelName, strconv.Quote(value))
}

func appendTimeRangeParams(values url.Values, tr apidata.TimeRange) {
	if tr.From == "" && tr.To == "" {
		return
	}
	rng := gtime.NewTimeRange(tr.From, tr.To)
	rng.Now = time.Now().UTC()
	if tr.From != "" {
		if fromT, err := rng.ParseFrom(); err == nil {
			values.Set("start", strconv.FormatInt(fromT.UnixNano(), 10))
		}
	}
	if tr.To != "" {
		if toT, err := rng.ParseTo(); err == nil {
			values.Set("end", strconv.FormatInt(toT.UnixNano(), 10))
		}
	}
}
