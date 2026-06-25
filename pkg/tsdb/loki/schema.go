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

var schemaBaseColumns = []schemas.Column{
	{Name: "timestamp", Type: schemas.ColumnTypeDatetime},
	{Name: "line", Type: schemas.ColumnTypeString},
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
}

// lokiDatasourceCapabilities declares what the SQL engine may push to Loki. Aggregates are
// not pushed to LogQL here (raw log rows are returned; SQL-layer aggregation applies).
var lokiDatasourceCapabilities = &schemas.DatasourceCapabilities{
	Limit: true,
}

type lokiLabelsAPIResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
}

// SchemaProvider implements schemads handlers for Loki (tables = values of the
// resolved table label; columns = timestamp, line, and stream labels).
type SchemaProvider struct {
	httpClient *http.Client
	url        string
	logger     log.Logger
	tracer     trace.Tracer

	tableLabelMu       sync.Mutex
	cachedTableLabel   string
	tableLabelCachedAt time.Time

	// cacheTTL overrides schemaTableLabelCacheTTL when non-zero (tests).
	cacheTTL time.Duration
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
	return &schemas.TablesResponse{
		Tables:       names,
		Capabilities: lokiDatasourceCapabilities,
	}, nil
}

// Columns implements schemas.ColumnsHandler.
func (p *SchemaProvider) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	out := make(map[string][]schemas.Column, len(req.Tables))
	for _, table := range req.Tables {
		labels, err := p.fetchLabelNamesForTable(ctx, tblLabel, table)
		if err != nil {
			p.logger.Warn("failed to fetch labels for table", "table", table, "error", err)
			out[table] = schemaBaseColumns
			continue
		}
		out[table] = buildColumnsFromLabels(labels, tblLabel)
	}
	return &schemas.ColumnsResponse{Columns: out}, nil
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (p *SchemaProvider) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	tblLabel := p.resolvedTableLabel(ctx)
	resp := &schemas.ColumnValuesResponse{
		ColumnValues: make(map[string][]string),
		Errors:       make(map[string]string),
	}
	for _, col := range req.Columns {
		if col == "timestamp" || col == "line" {
			continue
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
	p.tableLabelMu.Lock()
	defer p.tableLabelMu.Unlock()
	now := time.Now()
	ttl := p.cacheTTLOrDefault()
	if !p.tableLabelCachedAt.IsZero() && now.Sub(p.tableLabelCachedAt) < ttl {
		return p.cachedTableLabel
	}
	p.cachedTableLabel = p.discoverTableLabel(ctx)
	p.tableLabelCachedAt = time.Now()
	return p.cachedTableLabel
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
