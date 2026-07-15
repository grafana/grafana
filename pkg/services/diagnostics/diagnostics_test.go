package diagnostics

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestBundler_Build(t *testing.T) {
	// No HAR captured (empty buffer, nil response) -> traffic.har omitted; only panel.json present.
	blob, err := NewBundler().Build(&harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panel.json")
	require.NotContains(t, files, "traffic.har", "no HAR was captured")
	require.NotContains(t, files, "dashboard.json", "no dashboard JSON supplied")
	require.NotContains(t, files, "server.log", "server log is intentionally omitted until it can be request-scoped")
	require.NotContains(t, files, "query-error.txt", "no query error")
	require.JSONEq(t, `{"id":1}`, string(files["panel.json"]))
}

func TestBundler_Build_recordsQueryError(t *testing.T) {
	// A failed query must still produce a bundle, with the error recorded (capture is not discarded).
	blob, err := NewBundler().Build(&harcapture.Buffer{}, nil, nil, errors.New("datasource timeout"))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "query-error.txt")
	require.Contains(t, string(files["query-error.txt"]), "datasource timeout")
}

func TestHasCapturedHAR(t *testing.T) {
	require.False(t, HasCapturedHAR(nil), "nil buffer -> nothing captured")
	require.False(t, HasCapturedHAR(&harcapture.Buffer{}), "empty buffer -> nothing captured")

	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)
	require.True(t, HasCapturedHAR(buf), "buffer with entries -> captured")
}

func TestCollectHAR_nilAndEmptyBuffer(t *testing.T) {
	out, err := collectHAR(nil)
	require.NoError(t, err)
	require.Nil(t, out)

	out, err = collectHAR(&harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)

	// A nil buffer must also flow through Build without panicking.
	bundle, err := NewBundler().Build(nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, bundle)
}

func TestCollectHAR_BufferOnly_returnedVerbatim(t *testing.T) {
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)

	out, err := collectHAR(buf)
	require.NoError(t, err)
	require.NotNil(t, out)

	// With no external frames, the buffer's own HAR document is returned as-is (no mergeHAR
	// re-marshal round-trip), so it must be byte-identical to Buffer.ToHAR().
	want, err := buf.ToHAR()
	require.NoError(t, err)
	require.Equal(t, want, out)

	var doc struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &doc))
	require.Len(t, doc.Log.Entries, 1)
}

func TestBuildTarGz(t *testing.T) {
	blob, err := buildTarGz(map[string][]byte{"b.txt": []byte("bbb"), "a.txt": []byte("aaa")})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Equal(t, "aaa", string(files["a.txt"]))
	require.Equal(t, "bbb", string(files["b.txt"]))
}

func TestBuildTarGz_deterministicOrder(t *testing.T) {
	blob, err := buildTarGz(map[string][]byte{"b.txt": []byte("b"), "a.txt": []byte("a"), "c.txt": []byte("c")})
	require.NoError(t, err)

	gz, err := gzip.NewReader(bytes.NewReader(blob))
	require.NoError(t, err)
	tr := tar.NewReader(gz)
	var names []string
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		names = append(names, hdr.Name)
	}
	require.Equal(t, []string{"a.txt", "b.txt", "c.txt"}, names, "files written in sorted order")
}

func TestIndentJSON(t *testing.T) {
	require.Equal(t, "{\n  \"a\": 1\n}", string(indentJSON([]byte(`{"a":1}`))))
	require.Equal(t, "not json", string(indentJSON([]byte("not json"))), "falls back to raw bytes when unparseable")
}

func TestResponseError(t *testing.T) {
	require.NoError(t, ResponseError(nil))
	require.NoError(t, ResponseError(&backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}))

	sentinel := errors.New("boom")
	err := ResponseError(&backend.QueryDataResponse{Responses: backend.Responses{
		"B": {Error: sentinel},
		"A": {Error: errors.New("bad query")},
	}})
	require.Error(t, err)
	// Typed classification survives (handleQueryMetricsError relies on errors.Is).
	require.ErrorIs(t, err, sentinel)
	// Combined, wrapped per refId, and ordered deterministically by refId.
	require.Equal(t, "A: bad query\nB: boom", err.Error())
}

func bufferWithEntry(t *testing.T, url string) *harcapture.Buffer {
	t.Helper()
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)
	return buf
}

func TestBuildDashboard(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 1, Title: "CPU Usage", PanelJSON: json.RawMessage(`{"id":1}`), Datasources: []string{"prom"}, HARBuffer: bufferWithEntry(t, "http://ds/1")},
		{ID: 2, Title: "Text panel", Skipped: "no queries (non-data panel)"},
	}
	blob, err := NewBundler().BuildDashboard(json.RawMessage(`{"title":"My dash"}`), panels, 2, false)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "dashboard.json")
	require.Contains(t, files, "manifest.json")
	require.Contains(t, files, "panels/1-cpu-usage/panel.json")
	require.Contains(t, files, "panels/1-cpu-usage/traffic.har")
	require.NotContains(t, files, "server.log", "server log is intentionally omitted (not request-scoped)")
	// A skipped panel gets no dir.
	for name := range files {
		require.NotContains(t, name, "panels/2", "skipped panel must not have a dir")
	}

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 2, m.PanelsTotal)
	require.Equal(t, 1, m.PanelsRun, "only the data panel ran")
	require.False(t, m.Truncated)
	require.Len(t, m.Panels, 2)
	require.Equal(t, "no queries (non-data panel)", m.Panels[1].Skipped)
	require.Equal(t, "panels/1-cpu-usage", m.Panels[0].Dir)
	require.Positive(t, m.Panels[0].HARBytes)
}

func TestBuildDashboard_recordsPanelQueryError(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 7, Title: "Broken", QueryErr: errors.New("datasource exploded")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels, 1, false)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/7-broken/query-error.txt")
	require.Contains(t, string(files["panels/7-broken/query-error.txt"]), "datasource exploded")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 0, m.PanelsRun, "a panel whose query errored is not counted as run")
	require.Equal(t, "datasource exploded", m.Panels[0].Error)
}

func TestBuildDashboard_truncationAndDirCollision(t *testing.T) {
	// Two panels share an id+title, so their dirs must be disambiguated.
	panels := []DashboardPanel{
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/a")},
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/b")},
	}
	// panelsTotal (10) > len(panels): the caller capped the list, so truncated is recorded.
	blob, err := NewBundler().BuildDashboard(nil, panels, 10, true)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-same/traffic.har")
	require.Contains(t, files, "panels/3-same-2/traffic.har", "collision disambiguated with a numeric suffix")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.True(t, m.Truncated)
	require.Equal(t, 10, m.PanelsTotal)
}

func readTarGz(t *testing.T, data []byte) map[string][]byte {
	t.Helper()

	gz, err := gzip.NewReader(bytes.NewReader(data))
	require.NoError(t, err)

	tr := tar.NewReader(gz)
	out := map[string][]byte{}
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		b, err := io.ReadAll(tr)
		require.NoError(t, err)
		out[hdr.Name] = b
	}
	return out
}
