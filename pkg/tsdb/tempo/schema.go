package tempo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	schemas "github.com/grafana/schemads"
)

const (
	tempoSchemadsTableSpans = "spans"
	defaultSearchTagsLimit  = 5000

	tempoSpanColTraceIDHidden = "traceIdHidden"
	tempoSpanColTraceService  = "traceService"
	tempoSpanColTraceName     = "traceName"
	tempoSpanColSpanID        = "spanID"
	tempoSpanColTime          = "time"
	tempoSpanColName          = "name"
	tempoSpanColDuration      = "duration"

	tempoMIMETypeJSON              = "application/json"
	tempoHTTPPathV2SearchTags      = "api/v2/search/tags"
	tempoHTTPPathV2SearchTagPrefix = "api/v2/search/tag"
	tempoHTTPPathTagValuesSuffix   = "values"

	tempoQueryParamLimit = "limit"
	tempoQueryParamStart = "start"
	tempoQueryParamEnd   = "end"

	tempoUnixMillisThreshold         = 1_000_000_000_000
	tempoDefaultTagValuesLookbackSec = 3600
)

func traceqlStringColumnOperators() []schemas.Operator {
	return []schemas.Operator{
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
		schemas.OperatorIn,
		schemas.OperatorLike,
	}
}

// tempoSchemaProvider implements schemads resource handlers for the Tempo datasource (schema metadata for dsabstraction).
type tempoSchemaProvider struct {
	s      *Service
	logger log.Logger
}

func newTempoSchemaProvider(s *Service, logger log.Logger) *tempoSchemaProvider {
	return &tempoSchemaProvider{s: s, logger: logger}
}

func (p *tempoSchemaProvider) dsInfo(ctx context.Context) (*DatasourceInfo, error) {
	pc := backend.PluginConfigFromContext(ctx)
	i, err := p.s.im.Get(ctx, pc)
	if err != nil {
		return nil, err
	}
	dsInfo, ok := i.(*DatasourceInfo)
	if !ok {
		return nil, fmt.Errorf("invalid datasource instance type")
	}
	return dsInfo, nil
}

func spansFixedColumnNames() map[string]struct{} {
	m := make(map[string]struct{})
	for _, c := range spansFixedColumns() {
		m[c.Name] = struct{}{}
	}
	return m
}

func spansFixedColumns() []schemas.Column {
	falsePtr := schemaBoolPtr(false)
	truePtr := schemaBoolPtr(true)
	traceqlStringOps := traceqlStringColumnOperators()
	timeOps := []schemas.Operator{
		schemas.OperatorGreaterThan,
		schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan,
		schemas.OperatorLessThanOrEqual,
	}
	durOps := []schemas.Operator{
		schemas.OperatorEquals,
		schemas.OperatorNotEquals,
		schemas.OperatorGreaterThan,
		schemas.OperatorGreaterThanOrEqual,
		schemas.OperatorLessThan,
		schemas.OperatorLessThanOrEqual,
	}
	return []schemas.Column{
		{Name: tempoSpanColTraceIDHidden, Type: schemas.ColumnTypeString, Operators: traceqlStringOps, Description: "Trace ID (used for drill-down links).", SupportsValues: falsePtr},
		{Name: tempoSpanColTraceService, Type: schemas.ColumnTypeString, Operators: traceqlStringOps, Description: "Root trace service name.", SupportsValues: falsePtr},
		{Name: tempoSpanColTraceName, Type: schemas.ColumnTypeString, Operators: traceqlStringOps, Description: "Root trace name.", SupportsValues: falsePtr},
		{Name: tempoSpanColSpanID, Type: schemas.ColumnTypeString, Operators: traceqlStringOps, Description: "Span ID.", SupportsValues: falsePtr},
		{Name: tempoSpanColTime, Type: schemas.ColumnTypeDatetime, Operators: timeOps, Description: "Span start time.", SupportsValues: falsePtr},
		{Name: tempoSpanColName, Type: schemas.ColumnTypeString, Operators: traceqlStringOps, Description: "Span name.", SupportsValues: truePtr},
		{Name: tempoSpanColDuration, Type: schemas.ColumnTypeFloat64, Operators: durOps, Description: "Span duration in nanoseconds.", SupportsValues: truePtr},
	}
}

func schemaBoolPtr(b bool) *bool {
	return &b
}

// mergeSpansColumnsUnique returns fixed span columns followed by dynamic tag columns,
// omitting any dynamic column whose Name collides with a fixed column (e.g. intrinsic
// "name" / "duration" from Tempo search tags API vs the same keys in spansFixedColumns).
func mergeSpansColumnsUnique(fixed, dynamic []schemas.Column) []schemas.Column {
	seen := make(map[string]struct{}, len(fixed)+len(dynamic))
	out := make([]schemas.Column, 0, len(fixed)+len(dynamic))
	for _, c := range fixed {
		if c.Name == "" {
			continue
		}
		if _, ok := seen[c.Name]; ok {
			continue
		}
		seen[c.Name] = struct{}{}
		out = append(out, c)
	}
	for _, c := range dynamic {
		if c.Name == "" {
			continue
		}
		if _, ok := seen[c.Name]; ok {
			continue
		}
		seen[c.Name] = struct{}{}
		out = append(out, c)
	}
	return out
}

func tempoSpansCapabilities() *schemas.DatasourceCapabilities {
	return &schemas.DatasourceCapabilities{}
}

// Schema implements schemas.SchemaHandler.
func (p *tempoSchemaProvider) Schema(ctx context.Context, _ *schemas.SchemaRequest) (*schemas.SchemaResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.SchemaResponse{Errors: err.Error()}, nil
	}
	tagCols, tagErr := p.dynamicTagColumns(ctx, dsInfo)
	if tagErr != nil {
		p.logger.Warn("tempo schemads: failed to load tags for schema", "error", tagErr)
		tagCols = nil
	}
	cols := mergeSpansColumnsUnique(spansFixedColumns(), tagCols)
	table := schemas.Table{
		Name:    tempoSchemadsTableSpans,
		Columns: cols,
	}
	resp := &schemas.SchemaResponse{
		FullSchema: &schemas.Schema{
			Tables:       []schemas.Table{table},
			Capabilities: tempoSpansCapabilities(),
		},
	}
	if tagErr != nil {
		resp.Errors = fmt.Sprintf("attribute columns unavailable: %v", tagErr)
	}
	return resp, nil
}

// Tables implements schemas.TablesHandler.
func (p *tempoSchemaProvider) Tables(ctx context.Context, _ *schemas.TablesRequest) (*schemas.TablesResponse, error) {
	_, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.TablesResponse{Errors: map[string]string{tempoSchemadsTableSpans: err.Error()}}, nil
	}
	return &schemas.TablesResponse{
		Tables:       []string{tempoSchemadsTableSpans},
		Capabilities: tempoSpansCapabilities(),
	}, nil
}

// Columns implements schemas.ColumnsHandler.
func (p *tempoSchemaProvider) Columns(ctx context.Context, req *schemas.ColumnsRequest) (*schemas.ColumnsResponse, error) {
	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.ColumnsResponse{
			Columns: map[string][]schemas.Column{},
			Errors:  map[string]string{tempoSchemadsTableSpans: err.Error()},
		}, nil
	}

	tagCols, tagErr := p.dynamicTagColumns(ctx, dsInfo)
	if tagErr != nil {
		p.logger.Warn("tempo schemads: failed to load tags for columns", "error", tagErr)
	}

	fixed := spansFixedColumns()
	out := make(map[string][]schemas.Column, len(req.Tables))
	for _, t := range req.Tables {
		if t != tempoSchemadsTableSpans {
			continue
		}
		merged := mergeSpansColumnsUnique(fixed, tagCols)
		out[tempoSchemadsTableSpans] = merged
	}
	resp := &schemas.ColumnsResponse{Columns: out}
	if tagErr != nil {
		resp.Errors = map[string]string{tempoSchemadsTableSpans: fmt.Sprintf("attribute columns unavailable: %v", tagErr)}
	}
	return resp, nil
}

// ColumnValues implements schemas.ColumnValuesHandler.
func (p *tempoSchemaProvider) ColumnValues(ctx context.Context, req *schemas.ColumnValuesRequest) (*schemas.ColumnValuesResponse, error) {
	out := make(map[string][]string, len(req.Columns))
	for _, c := range req.Columns {
		out[c] = nil
	}
	if req.Table != tempoSchemadsTableSpans || len(req.Columns) == 0 {
		return &schemas.ColumnValuesResponse{ColumnValues: out}, nil
	}

	dsInfo, err := p.dsInfo(ctx)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			ColumnValues: out,
			Errors:       globalColumnValuesErrors(req.Columns, err.Error()),
		}, nil
	}

	scopes, err := fetchTempoSearchTagScopes(ctx, dsInfo, defaultSearchTagsLimit)
	if err != nil {
		return &schemas.ColumnValuesResponse{
			ColumnValues: out,
			Errors:       globalColumnValuesErrors(req.Columns, err.Error()),
		}, nil
	}

	tagCols := tagColumnNamesSetFromScopes(scopes)
	noTagValues := spansFixedColumnNamesNoTagValues()
	errs := make(map[string]string)
	for _, col := range req.Columns {
		if _, skip := noTagValues[col]; skip {
			continue
		}
		if _, ok := tagCols[col]; !ok {
			continue
		}
		vals, err := fetchTempoTagValuesForColumn(ctx, dsInfo, col, req.TimeRange)
		if err != nil {
			p.logger.Warn("tempo schemads: tag values", "column", col, "error", err)
			errs[col] = err.Error()
			continue
		}
		out[col] = vals
	}
	if len(errs) == 0 {
		errs = nil
	}
	return &schemas.ColumnValuesResponse{ColumnValues: out, Errors: errs}, nil
}

// spansFixedColumnNamesNoTagValues is the set of fixed span columns that never use the
// Tempo tag-values API. It is derived from spansFixedColumns (SupportsValues == false)
// so metadata and ColumnValues stay aligned.
func spansFixedColumnNamesNoTagValues() map[string]struct{} {
	m := make(map[string]struct{})
	for _, c := range spansFixedColumns() {
		if c.SupportsValues != nil && *c.SupportsValues {
			continue
		}
		m[c.Name] = struct{}{}
	}
	return m
}

// globalColumnValuesErrors attaches msg to each requested column that can use tag-values,
// except fixed columns that never have that API (see spansFixedColumnNamesNoTagValues).
// If there are no such columns, msg is returned under the empty key for schemads consumers
// that expect a single global error.
func globalColumnValuesErrors(columns []string, msg string) map[string]string {
	noTag := spansFixedColumnNamesNoTagValues()
	errs := make(map[string]string)
	for _, col := range columns {
		if _, skip := noTag[col]; skip {
			continue
		}
		errs[col] = msg
	}
	if len(errs) == 0 {
		errs[""] = msg
	}
	return errs
}

func (p *tempoSchemaProvider) dynamicTagColumns(ctx context.Context, dsInfo *DatasourceInfo) ([]schemas.Column, error) {
	scopes, err := fetchTempoSearchTagScopes(ctx, dsInfo, defaultSearchTagsLimit)
	if err != nil {
		return nil, err
	}
	fixedNames := spansFixedColumnNames()
	names := flattenTempoSearchTagScopesToColumnNames(scopes)
	truePtr := schemaBoolPtr(true)
	cols := make([]schemas.Column, 0, len(names))
	for _, n := range names {
		if _, isFixed := fixedNames[n]; isFixed {
			continue
		}
		cols = append(cols, schemas.Column{
			Name:           n,
			Type:           schemas.ColumnTypeString,
			Operators:      traceqlStringColumnOperators(),
			Description:    "Attribute tag from Tempo.",
			SupportsValues: truePtr,
		})
	}
	return cols, nil
}

type tempoSearchTagsV2Response struct {
	Scopes []tempoSearchTagScope `json:"scopes"`
}

type tempoSearchTagScope struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

func fetchTempoSearchTagScopes(ctx context.Context, dsInfo *DatasourceInfo, limit int) ([]tempoSearchTagScope, error) {
	parsed, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("parse datasource url: %w", err)
	}
	parsed.Path = path.Join(parsed.Path, tempoHTTPPathV2SearchTags)
	q := parsed.Query()
	q.Set(tempoQueryParamLimit, strconv.Itoa(limit))
	parsed.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", tempoMIMETypeJSON)

	resp, err := dsInfo.HTTPClient.Do(req) // #nosec G107 -- URL comes from operator-configured datasource
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("tempo tags request: %s: %s", resp.Status, string(body))
	}

	var parsedBody tempoSearchTagsV2Response
	if err := json.Unmarshal(body, &parsedBody); err != nil {
		return nil, fmt.Errorf("decode tags response: %w", err)
	}
	return parsedBody.Scopes, nil
}

type tempoTagValuesResponse struct {
	TagValues []struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	} `json:"tagValues"`
}

func fetchTempoTagValuesForColumn(ctx context.Context, dsInfo *DatasourceInfo, tag string, tr apidata.TimeRange) ([]string, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, fmt.Errorf("parse datasource url: %w", err)
	}
	u.Path = path.Join(u.Path, tempoHTTPPathV2SearchTagPrefix, url.PathEscape(tag), tempoHTTPPathTagValuesSuffix)
	q := u.Query()
	q.Set(tempoQueryParamLimit, strconv.Itoa(defaultSearchTagsLimit))
	start, end := timeRangeToUnixForTempoTagAPI(tr)
	q.Set(tempoQueryParamStart, strconv.FormatInt(start, 10))
	q.Set(tempoQueryParamEnd, strconv.FormatInt(end, 10))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", tempoMIMETypeJSON)

	resp, err := dsInfo.HTTPClient.Do(req) // #nosec G107 -- URL comes from operator-configured datasource
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("tempo tag values: %s: %s", resp.Status, string(body))
	}

	var parsed tempoTagValuesResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decode tag values: %w", err)
	}
	seen := make(map[string]struct{})
	for _, tv := range parsed.TagValues {
		if tv.Value == "" {
			continue
		}
		seen[tv.Value] = struct{}{}
	}
	vals := make([]string, 0, len(seen))
	for v := range seen {
		vals = append(vals, v)
	}
	sort.Strings(vals)
	return vals, nil
}

func timeRangeToUnixForTempoTagAPI(tr apidata.TimeRange) (start, end int64) {
	fromS := strings.TrimSpace(tr.From)
	toS := strings.TrimSpace(tr.To)
	if fromS == "" || toS == "" {
		now := time.Now().Unix()
		return now - tempoDefaultTagValuesLookbackSec, now
	}
	fromT, err1 := parseFlexibleTimeForTagValues(fromS)
	toT, err2 := parseFlexibleTimeForTagValues(toS)
	if err1 != nil || err2 != nil {
		now := time.Now().Unix()
		return now - tempoDefaultTagValuesLookbackSec, now
	}
	return fromT.Unix(), toT.Unix()
}

func parseFlexibleTimeForTagValues(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty time string")
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	if ms, err := strconv.ParseInt(s, 10, 64); err == nil {
		if ms > tempoUnixMillisThreshold {
			return time.UnixMilli(ms), nil
		}
		return time.Unix(ms, 0), nil
	}
	return time.Time{}, fmt.Errorf("unsupported time format: %q", s)
}

func tagColumnNamesSetFromScopes(scopes []tempoSearchTagScope) map[string]struct{} {
	names := flattenTempoSearchTagScopesToColumnNames(scopes)
	m := make(map[string]struct{}, len(names))
	for _, n := range names {
		m[n] = struct{}{}
	}
	return m
}

func flattenTempoSearchTagScopesToColumnNames(scopes []tempoSearchTagScope) []string {
	seen := make(map[string]struct{})
	for _, sc := range scopes {
		scopeName := sc.Name
		for _, t := range sc.Tags {
			if t == "" {
				continue
			}
			var col string
			if dataquery.TraceqlSearchScope(scopeName) == dataquery.TraceqlSearchScopeIntrinsic {
				col = t
			} else {
				col = scopeName + "." + t
			}
			seen[col] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
