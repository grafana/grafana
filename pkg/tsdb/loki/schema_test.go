package loki

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	apidata "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	schemas "github.com/grafana/schemads"
	"github.com/stretchr/testify/require"
)

type mockSchemaTransport struct {
	t  *testing.T
	fn func(*http.Request) (int, string, []byte)
}

func (m *mockSchemaTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	status, ct, body := m.fn(req)
	if status == 0 {
		status = 200
	}
	if ct == "" {
		ct = "application/json"
	}
	h := http.Header{}
	h.Set("Content-Type", ct)
	return &http.Response{
		StatusCode: status,
		Header:     h,
		Body:       io.NopCloser(strings.NewReader(string(body))),
	}, nil
}

func newTestSchemaProvider(t *testing.T, fn func(*http.Request) (int, string, []byte)) *SchemaProvider {
	t.Helper()
	client := &http.Client{Transport: &mockSchemaTransport{t: t, fn: fn}}
	return NewSchemaProvider(client, "http://loki.test", backend.NewLoggerWith("logger", "loki schema test"), tracing.DefaultTracer())
}

func TestSchemaProvider_DiscoverTableLabel_PrefersServiceName(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["app","service_name","job"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/label/service_name/values"):
			require.Equal(t, "", req.URL.Query().Get("query"))
			return 200, "", []byte(`{"status":"success","data":["my-svc"]}`)
		default:
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
		}
		return 0, "", nil
	})

	ctx := context.Background()
	tr, err := p.Tables(ctx, &schemas.TablesRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"my-svc"}, tr.Tables)
	require.Equal(t, lokiDatasourceCapabilities, tr.Capabilities)
}

func TestSchemaProvider_DiscoverTableLabel_FallbackToApp(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["app","job"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/label/app/values"):
			return 200, "", []byte(`{"status":"success","data":["frontend"]}`)
		default:
			t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
		}
		return 0, "", nil
	})

	tr, err := p.Tables(context.Background(), &schemas.TablesRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"frontend"}, tr.Tables)
}

func TestSchemaProvider_DiscoverTableLabel_ListLabelsFails(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		if strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "" {
			return 500, "", []byte(`{"message":"error"}`)
		}
		if strings.Contains(req.URL.Path, "/loki/api/v1/label/service_name/values") {
			return 200, "", []byte(`{"status":"success","data":["x"]}`)
		}
		t.Fatalf("unexpected request: %s", req.URL.String())
		return 0, "", nil
	})

	tr, err := p.Tables(context.Background(), &schemas.TablesRequest{})
	require.NoError(t, err)
	require.Equal(t, []string{"x"}, tr.Tables)
}

func TestSchemaProvider_Columns(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name`):
			require.Contains(t, req.URL.Query().Get("query"), `"svc-a"`)
			return 200, "", []byte(`{"status":"success","data":["service_name","pod","level"]}`)
		default:
			t.Fatalf("unexpected request: %s", req.URL.String())
		}
		return 0, "", nil
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{Tables: []string{"svc-a"}})
	require.NoError(t, err)
	cols := cr.Columns["svc-a"]
	require.GreaterOrEqual(t, len(cols), 5)
	require.Equal(t, "timestamp", cols[0].Name)
	require.Equal(t, "line", cols[1].Name)
	require.Equal(t, "value", cols[2].Name)
	var names []string
	for i := 3; i < len(cols); i++ {
		names = append(names, cols[i].Name)
	}
	require.Equal(t, []string{"level", "pod"}, names)
}

func TestSchemaProvider_Columns_withParserProbe(t *testing.T) {
	var queryRangeCalled atomic.Bool
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name="carts"`):
			return 200, "", []byte(`{"status":"success","data":["env","service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/query_range"):
			queryRangeCalled.Store(true)
			require.Contains(t, req.URL.Query().Get("query"), "| json")
			return 200, "", []byte(`{"status":"success","data":{"resultType":"streams","result":[{"stream":{"env":"prod","level":"error","service_name":"carts"},"values":[["1700000000000000000","{}"]]}]}}`)
		default:
			t.Fatalf("unexpected request: %s", req.URL.String())
		}
		return 0, "", nil
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{
		Tables:        []string{"carts"},
		SchemaContext: map[string]string{"PARSER": "json"},
	})
	require.NoError(t, err)
	require.True(t, queryRangeCalled.Load())

	names := columnNames(cr.Columns["carts"])
	require.Contains(t, names, "level")
	require.Contains(t, names, "env")
}

func TestSchemaProvider_Columns_withPatternProbe(t *testing.T) {
	var queryRangeCalled atomic.Bool
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name="nginx"`):
			return 200, "", []byte(`{"status":"success","data":["env","service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/query_range"):
			queryRangeCalled.Store(true)
			require.Contains(t, req.URL.Query().Get("query"), `| pattern "<status>"`)
			return 200, "", []byte(`{"status":"success","data":{"resultType":"streams","result":[{"stream":{"env":"prod","method":"GET","service_name":"nginx","status":"500"},"values":[["1700000000000000000","{}"]]}]}}`)
		default:
			t.Fatalf("unexpected request: %s", req.URL.String())
		}
		return 0, "", nil
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{
		Tables:        []string{"nginx"},
		SchemaContext: map[string]string{"PARSER": "pattern", "PATTERN": "<status>"},
	})
	require.NoError(t, err)
	require.True(t, queryRangeCalled.Load())

	names := columnNames(cr.Columns["nginx"])
	require.Contains(t, names, "status")
	require.Contains(t, names, "method")
}

func TestSchemaProvider_Columns_withParserSchemaContext(t *testing.T) {
	var queryRangeCalled atomic.Bool
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && strings.Contains(req.URL.Query().Get("query"), `service_name="carts"`):
			return 200, "", []byte(`{"status":"success","data":["env","service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/query_range"):
			queryRangeCalled.Store(true)
			require.Contains(t, req.URL.Query().Get("query"), "| logfmt")
			return 200, "", []byte(`{"status":"success","data":{"resultType":"streams","result":[{"stream":{"level":"info","msg":"hello","service_name":"carts"},"values":[["1700000000000000000","{}"]]}]}}`)
		default:
			t.Fatalf("unexpected request: %s", req.URL.String())
		}
		return 0, "", nil
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{
		Tables:        []string{"carts"},
		SchemaContext: map[string]string{"PARSER": "logfmt"},
	})
	require.NoError(t, err)
	require.True(t, queryRangeCalled.Load())

	names := columnNames(cr.Columns["carts"])
	require.Contains(t, names, "level")
	require.Contains(t, names, "msg")
}

func columnNames(cols []schemas.Column) []string {
	names := make([]string, 0, len(cols))
	for _, c := range cols {
		names = append(names, c.Name)
	}
	return names
}

func TestSchemaProvider_Columns_PerTableErrorFallback(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		if strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "" {
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		}
		if strings.Contains(req.URL.Query().Get("query"), "bad") {
			return 500, "", []byte(`{"message":"no"}`)
		}
		return 200, "", []byte(`{"status":"success","data":["pod"]}`)
	})

	cr, err := p.Columns(context.Background(), &schemas.ColumnsRequest{Tables: []string{"bad", "good"}})
	require.NoError(t, err)
	require.Len(t, cr.Columns["bad"], len(schemaBaseColumns))
	require.Greater(t, len(cr.Columns["good"]), len(schemaBaseColumns))
}

func TestSchemaProvider_ColumnValues_SkipsTimestampLineAndValue(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		if strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "" {
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		}
		if strings.Contains(req.URL.Path, "/loki/api/v1/label/level/values") {
			require.Contains(t, req.URL.Query().Get("query"), `"svc-a"`)
			return 200, "", []byte(`{"status":"success","data":["info","error"]}`)
		}
		t.Fatalf("unexpected request: %s", req.URL.String())
		return 0, "", nil
	})

	resp, err := p.ColumnValues(context.Background(), &schemas.ColumnValuesRequest{
		Table:   "svc-a",
		Columns: []string{"timestamp", "line", "level"},
		TimeRange: apidata.TimeRange{
			From: "now-1h",
			To:   "now",
		},
	})
	require.NoError(t, err)
	require.Contains(t, resp.ColumnValues, "level")
	require.Equal(t, []string{"info", "error"}, resp.ColumnValues["level"])
	_, hasTs := resp.ColumnValues["timestamp"]
	require.False(t, hasTs)
}

func TestSchemaCacheKeys_doNotCollide(t *testing.T) {
	parsedKey := schemaParsedLabelsCacheKey("service_name", "carts", "json")
	require.Equal(t, "service_name\x00carts\x00json", parsedKey)
	require.NotEqual(t, schemaCacheKeyTableLabel, parsedKey)
}

func TestSchemaProvider_TableLabelCache_Expires(t *testing.T) {
	var listLabelsCalls atomic.Int32
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		if strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "" {
			listLabelsCalls.Add(1)
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		}
		if strings.Contains(req.URL.Path, "/loki/api/v1/label/service_name/values") {
			return 200, "", []byte(`{"status":"success","data":["a"]}`)
		}
		t.Fatalf("unexpected request: %s", req.URL.String())
		return 0, "", nil
	})
	const shortTTL = 100 * time.Millisecond
	p.cacheTTL = shortTTL

	ctx := context.Background()
	_, err := p.Tables(ctx, &schemas.TablesRequest{})
	require.NoError(t, err)
	require.EqualValues(t, 1, listLabelsCalls.Load())

	time.Sleep(shortTTL / 5)
	_, err = p.Tables(ctx, &schemas.TablesRequest{})
	require.NoError(t, err)
	require.EqualValues(t, 1, listLabelsCalls.Load())

	time.Sleep(shortTTL + 50*time.Millisecond)
	_, err = p.Tables(ctx, &schemas.TablesRequest{})
	require.NoError(t, err)
	require.EqualValues(t, 2, listLabelsCalls.Load())
}

func TestSchemaProvider_Schema(t *testing.T) {
	p := newTestSchemaProvider(t, func(req *http.Request) (int, string, []byte) {
		switch {
		case strings.HasSuffix(req.URL.Path, "/loki/api/v1/labels") && req.URL.Query().Get("query") == "":
			return 200, "", []byte(`{"status":"success","data":["service_name"]}`)
		case strings.Contains(req.URL.Path, "/loki/api/v1/label/service_name/values"):
			return 200, "", []byte(`{"status":"success","data":["a","b"]}`)
		default:
			t.Fatalf("unexpected request: %s", req.URL.String())
		}
		return 0, "", nil
	})

	sr, err := p.Schema(context.Background(), &schemas.SchemaRequest{})
	require.NoError(t, err)
	require.Len(t, sr.FullSchema.Tables, 2)
	require.Equal(t, "a", sr.FullSchema.Tables[0].Name)
	require.Equal(t, schemaBaseColumns, sr.FullSchema.Tables[0].Columns)
	require.Equal(t, lokiTableHints, sr.FullSchema.Tables[0].TableHints)
	require.True(t, sr.FullSchema.Tables[0].TableHints[4].AffectsSchema)
	require.Equal(t, lokiDatasourceCapabilities, sr.FullSchema.Capabilities)
}

func Test_appendTimeRangeParams(t *testing.T) {
	v := url.Values{}
	v.Set("query", `{service_name="x"}`)
	from := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	to := time.Date(2024, 6, 1, 13, 0, 0, 0, time.UTC)
	appendTimeRangeParams(v, apidata.TimeRange{
		From: from.Format(time.RFC3339Nano),
		To:   to.Format(time.RFC3339Nano),
	})
	require.NotEmpty(t, v.Get("start"))
	require.NotEmpty(t, v.Get("end"))
}
