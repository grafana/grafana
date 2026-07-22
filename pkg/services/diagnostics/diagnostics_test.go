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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestBundler_Build(t *testing.T) {
	// No HAR captured (empty buffer, nil response) -> traffic.har omitted; only panel.json present.
	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil)
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
	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, errors.New("datasource timeout"))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "query-error.txt")
	require.Contains(t, string(files["query-error.txt"]), "datasource timeout")
}

func TestMergeHAR(t *testing.T) {
	d1 := []byte(`{"log":{"creator":{"name":"A","version":"1"},"entries":[{"n":1}]}}`)
	d2 := []byte(`{"log":{"entries":[{"n":2},{"n":3}]}}`)
	malformed := []byte(`not json`)

	out, err := mergeHAR([][]byte{d1, malformed, d2})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Version string            `json:"version"`
			Creator json.RawMessage   `json:"creator"`
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Equal(t, "1.2", env.Log.Version)
	require.Len(t, env.Log.Entries, 3, "entries from all valid docs are concatenated; malformed skipped")
	require.JSONEq(t, `{"name":"A","version":"1"}`, string(env.Log.Creator), "first creator is kept")

	// No parseable entries -> (nil, nil): benign "nothing captured", not an error.
	out, err = mergeHAR([][]byte{malformed})
	require.NoError(t, err)
	require.Nil(t, out)
	out, err = mergeHAR(nil)
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_emptyExternalFrame_benign(t *testing.T) {
	// A valid-but-empty external frame ({"log":{"entries":[]}}) is "no traffic", not a failure:
	// collectHAR must return (nil, nil) so the handler produces a 200 bundle without traffic.har,
	// not a 500. (Regression guard: an untrusted plugin's empty capture must not fail the run.)
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestHasCapturedHAR(t *testing.T) {
	require.False(t, HasCapturedHAR(nil, &harcapture.Buffer{}), "no buffer entries, no response")
	require.False(t, HasCapturedHAR(&backend.QueryDataResponse{Responses: backend.Responses{}}, &harcapture.Buffer{}))

	// In-process buffer with entries counts as captured.
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)
	require.True(t, HasCapturedHAR(nil, buf), "buffer with entries -> captured")

	// An external __har__ frame counts as captured even when the in-process buffer is empty — the
	// handler must not short-circuit a failed query away in that case.
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}
	require.True(t, HasCapturedHAR(resp, &harcapture.Buffer{}))

	// A __har__ frame WITHOUT a har payload must NOT count as captured (else the no-capture error
	// path is wrongly suppressed and the bundle is empty).
	empty := data.NewFrame("")
	empty.Meta = &data.FrameMeta{Custom: map[string]interface{}{"other": "x"}}
	noPayload := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{empty}}}}
	require.False(t, HasCapturedHAR(noPayload, &harcapture.Buffer{}), "frame without a har payload is not captured traffic")

	// A __har__ frame with a non-empty but unparseable har payload must NOT count as captured
	// either: collectHAR/mergeHAR would skip it and contribute nothing, so counting it here would
	// let a failed query fall through to a 200 bundle with no traffic.har -- the exact outcome the
	// no-capture error path exists to prevent.
	malformed := data.NewFrame("")
	malformed.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "not valid har"}}
	malformedResp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{malformed}}}}
	require.False(t, HasCapturedHAR(malformedResp, &harcapture.Buffer{}), "a malformed har payload is not captured traffic")
}

func TestCollectHAR_malformedExternalFrame_benign(t *testing.T) {
	// A frame carries a non-empty but unparseable "har" payload and there's no in-process buffer.
	// Redaction is deferred, so the frame is merged verbatim: mergeHAR skips the unparseable document
	// and, with no other entries, returns (nil, nil) — a benign empty bundle, not an error.
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "not valid har"}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_ExternalFramesVerbatim_andNilFrame(t *testing.T) {
	// A frame with a secret in a request header. Redaction is intentionally deferred, so it must be
	// merged VERBATIM (the secret is preserved, not stripped) — same policy as in-process capture.
	frameHAR := `{"log":{"entries":[{"request":{"headers":[{"name":"Authorization","value":"Bearer FRAMESECRET"}],"queryString":[],"cookies":[],"url":"http://x/y"},"response":{"headers":[],"cookies":[]}}]}}`
	withHAR := data.NewFrame("")
	withHAR.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": frameHAR}}

	resp := &backend.QueryDataResponse{
		Responses: backend.Responses{
			// A nil frame must not panic (regression guard), and the HAR frame must be collected.
			"__har__": backend.DataResponse{Frames: data.Frames{nil, withHAR}},
		},
	}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 1)
	require.Contains(t, string(out), "FRAMESECRET", "external-plugin frame is merged verbatim (redaction deferred)")

	_, ok := resp.Responses["__har__"]
	require.False(t, ok, "__har__ synthetic response is consumed, not returned to the client")
}

func TestCollectHAR_nilBuffer_noPanic(t *testing.T) {
	out, err := collectHAR(nil, nil)
	require.NoError(t, err)
	require.Nil(t, out)

	// A nil buffer must also flow through Build without panicking.
	bundle, err := NewBundler().Build(nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, bundle)
}

func TestCollectHAR_Empty(t *testing.T) {
	out, err := collectHAR(nil, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)

	out, err = collectHAR(&backend.QueryDataResponse{Responses: backend.Responses{}}, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_BufferOnly_returnedVerbatim(t *testing.T) {
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)

	out, err := collectHAR(nil, buf)
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

func TestCollectHAR_mergesBufferAndExternalFrame(t *testing.T) {
	// Both sources captured traffic: the in-process buffer (core) and an external __har__ frame.
	// collectHAR must merge them into one HAR document carrying both entries.
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://core.example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)

	frameHAR := `{"log":{"entries":[{"request":{"url":"http://external/y"}}]}}`
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": frameHAR}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, buf)
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 2, "buffer entry + external frame entry are both present")
}

func TestCollectHAR_multipleDatasources_namespacedRefIDs(t *testing.T) {
	// Regression guard for the multi-datasource collision: the SDK namespaces the capture refId per
	// datasource ("__har__<uid>"), so a query spanning two external datasources yields two distinct
	// __har__-prefixed responses. collectHAR must collect BOTH (not just one) and consume both.
	frameA := data.NewFrame("__har__A")
	frameA.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[{"request":{"url":"http://a/1"}}]}}`}}
	frameB := data.NewFrame("__har__B")
	frameB.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[{"request":{"url":"http://b/1"}},{"request":{"url":"http://b/2"}}]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": backend.DataResponse{Frames: data.Frames{frameA}},
		"__har__B": backend.DataResponse{Frames: data.Frames{frameB}},
	}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 3, "entries from BOTH datasources' capture frames are merged (1 + 2)")

	_, aKept := resp.Responses["__har__A"]
	_, bKept := resp.Responses["__har__B"]
	require.False(t, aKept || bKept, "all __har__-prefixed synthetic responses are consumed")
}

func TestHasCapturedHAR_namespacedRefID(t *testing.T) {
	f := data.NewFrame("__har__P123")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__P123": backend.DataResponse{Frames: data.Frames{f}}}}
	require.True(t, HasCapturedHAR(resp, &harcapture.Buffer{}), "a datasource-namespaced capture frame counts as captured")
}

func TestResponseError_skipsNamespacedHARFrames(t *testing.T) {
	// Namespaced synthetic responses must be skipped by ResponseError (their error is read via
	// PluginCaptureError); a real per-refId error alongside them is still reported.
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": {Error: errors.New("swallowed A")},
		"__har__B": {Error: errors.New("swallowed B")},
		"C":        {Error: errors.New("real boom")},
	}}
	require.EqualError(t, ResponseError(resp), "C: real boom")
}

func TestPluginCaptureError_multipleDatasources(t *testing.T) {
	// Each external datasource can stash its own queryError under its namespaced frame; report all,
	// ordered deterministically.
	fa := data.NewFrame("__har__A")
	fa.Meta = &data.FrameMeta{Custom: map[string]interface{}{"queryError": "boom A"}}
	fb := data.NewFrame("__har__B")
	fb.Meta = &data.FrameMeta{Custom: map[string]interface{}{"queryError": "boom B"}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": {Frames: data.Frames{fa}},
		"__har__B": {Frames: data.Frames{fb}},
	}}
	require.EqualError(t, PluginCaptureError(resp), "boom A\nboom B")
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

func TestPluginCaptureError(t *testing.T) {
	require.NoError(t, PluginCaptureError(nil))
	require.NoError(t, PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}))

	// No queryError in the frame -> nil.
	noErr := data.NewFrame("__har__")
	noErr.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "{}"}}
	require.NoError(t, PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Frames: data.Frames{noErr}},
	}}))

	// queryError present -> surfaced.
	withErr := data.NewFrame("__har__")
	withErr.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "{}", "queryError": "datasource boom"}}
	err := PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Frames: data.Frames{withErr}},
	}})
	require.EqualError(t, err, "datasource boom")
}

func TestResponseError_skipsSyntheticHARFrame(t *testing.T) {
	// The SDK sets an error on the synthetic __har__ response so its own middlewares see the failure;
	// ResponseError must not surface it under the reserved refID (PluginCaptureError handles it).
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Error: errors.New("swallowed boom")},
	}}
	require.NoError(t, ResponseError(resp), "__har__ synthetic error must be skipped")
	// A real per-refId error alongside it is still reported.
	resp.Responses["A"] = backend.DataResponse{Error: errors.New("real boom")}
	require.EqualError(t, ResponseError(resp), "A: real boom")
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
	blob, err := NewBundler().BuildDashboard(json.RawMessage(`{"title":"My dash"}`), panels)
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
	require.Len(t, m.Panels, 2)
	require.Equal(t, "no queries (non-data panel)", m.Panels[1].Skipped)
	require.Equal(t, "panels/1-cpu-usage", m.Panels[0].Dir)
	require.Positive(t, m.Panels[0].HARBytes)
}

// The whole-dashboard client posts the dashboard save model once instead of each panel's JSON, so
// BuildDashboard must resolve each panel's panel.json from that model by id -- including panels nested
// inside a collapsed row.
func TestBuildDashboard_resolvesPanelJSONFromDashboardModel(t *testing.T) {
	dashboardJSON := json.RawMessage(`{
		"title": "My dash",
		"panels": [
			{"id": 1, "type": "timeseries", "title": "CPU Usage"},
			{"id": 9, "type": "row", "title": "Row", "panels": [
				{"id": 2, "type": "logs", "title": "Logs"}
			]}
		]
	}`)
	// Neither panel carries inline PanelJSON -- it must be extracted from dashboardJSON by id.
	panels := []DashboardPanel{
		{ID: 1, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/1")},
		{ID: 2, Title: "Logs", HARBuffer: bufferWithEntry(t, "http://ds/2")},
	}
	blob, err := NewBundler().BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/panel.json", "top-level panel JSON resolved by id")
	require.Contains(t, files, "panels/2-logs/panel.json", "panel nested in a collapsed row resolved by id")
	require.Contains(t, string(files["panels/1-cpu-usage/panel.json"]), `"timeseries"`)
	require.Contains(t, string(files["panels/2-logs/panel.json"]), `"logs"`)
}

func TestIndexPanelJSON(t *testing.T) {
	dash := json.RawMessage(`{"panels":[{"id":1,"type":"a"},{"id":5,"type":"row","panels":[{"id":6,"type":"b"}]}]}`)
	panelsByID := indexPanelJSON(dash)
	require.Contains(t, string(panelsByID[1]), `"a"`)
	require.Contains(t, string(panelsByID[6]), `"b"`, "must index panels nested in a row")
	require.NotContains(t, panelsByID, int64(99), "unknown id is omitted")
	require.Empty(t, indexPanelJSON(nil), "empty dashboard produces an empty index")
	require.Empty(t, indexPanelJSON(json.RawMessage(`not json`)), "malformed dashboard produces an empty index")
}

func TestBuildDashboard_recordsPanelQueryError(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 7, Title: "Broken", QueryErr: errors.New("datasource exploded")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/7-broken/query-error.txt")
	require.Contains(t, string(files["panels/7-broken/query-error.txt"]), "datasource exploded")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 0, m.PanelsRun, "a panel whose query errored is not counted as run")
	require.Equal(t, "datasource exploded", m.Panels[0].Error)
}

func TestBuildDashboard_dirCollision(t *testing.T) {
	// Two panels share an id+title, so their dirs must be disambiguated.
	panels := []DashboardPanel{
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/a")},
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/b")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-same/traffic.har")
	require.Contains(t, files, "panels/3-same-2/traffic.har", "collision disambiguated with a numeric suffix")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 2, m.PanelsTotal)
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
