package diagnostics

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestBundler_Build(t *testing.T) {
	// No HAR captured (empty buffer, nil response) -> traffic.har omitted; only panel.json present.
	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil, nil, nil)
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
	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, nil, nil, nil, nil, errors.New("datasource timeout"))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "query-error.txt")
	require.Contains(t, string(files["query-error.txt"]), "datasource timeout")
}

func TestBundler_Build_recordsQueryDataMarshalError(t *testing.T) {
	// A query-data artifact that cannot be JSON-encoded (here forced with an invalid request payload,
	// the same failure mode as a non-finite float in a response) must not sink the whole bundle: the
	// error is recorded and the other artifacts still ship, mirroring the per-panel dashboard path.
	buf := bufferWithEntry(t, "http://ds/1")

	blob, _, err := NewBundler(nil).Build(nil, buf, nil, nil, json.RawMessage(`{invalid`), nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "querydata.json", "unserializable query data is omitted")
	require.Contains(t, files, "querydata-error.txt")
	require.Contains(t, string(files["querydata-error.txt"]), "invalid character")
	require.Contains(t, files, "traffic.har", "other artifacts still ship")
}

func TestBundler_Build_recordsQueryRequestSerializeError(t *testing.T) {
	// The caller failing to serialize the request (queryRequestErr) must not silently omit the request:
	// the failure is recorded in querydata-error.txt and the other captured artifacts still ship,
	// mirroring how the per-panel dashboard path surfaces the same failure via manifest.queryDataError.
	buf := bufferWithEntry(t, "http://ds/1")

	blob, _, err := NewBundler(nil).Build(nil, buf, nil, nil, nil, errors.New("unsupported value: +Inf"), nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "querydata.json", "request could not be serialized")
	require.Contains(t, files, "querydata-error.txt")
	require.Contains(t, string(files["querydata-error.txt"]), "serialize query request")
	require.Contains(t, string(files["querydata-error.txt"]), "unsupported value: +Inf")
	require.Contains(t, files, "traffic.har", "other artifacts still ship")
}

func TestBundler_Build_recordsQueryDataResponse(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frame}},
	}}

	blob, _, err := NewBundler(nil).Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")
	require.Contains(t, string(files["querydata.json"]), `"A"`)
	require.Contains(t, string(files["querydata.json"]), `42`)
}

func TestBundler_Build_recordsQueryDataRequest(t *testing.T) {
	request := json.RawMessage(`{"from":"now-1h","to":"now","queries":[{"refId":"A","expr":"up"}]}`)

	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")
	require.Contains(t, string(files["querydata.json"]), `"request"`)
	require.Contains(t, string(files["querydata.json"]), `"expr": "up"`)
}

func TestBundler_Build_excludesCaptureFramesFromQueryData(t *testing.T) {
	result := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	capture := data.NewFrame("")
	capture.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A":         {Frames: data.Frames{result}},
		"__har__ds": {Frames: data.Frames{capture}},
	}}

	blob, _, err := NewBundler(nil).Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, string(files["querydata.json"]), "__har__")
	require.Contains(t, string(files["querydata.json"]), `"A"`)
}

func TestBundler_Build_preservesUpstreamAndPluginResultsForComparison(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "http://prometheus/api/v1/query", nil)
	require.NoError(t, err)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Proto:      "HTTP/1.1",
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"series":["host-a","host-b"]}`)),
	}
	buf := &harcapture.Buffer{}
	buf.AddEntry(req, resp, nil, time.Now(), time.Millisecond)

	pluginFrame := data.NewFrame("cpu", data.NewField("host", nil, []string{"host-a"}))
	queryResp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{pluginFrame}},
	}}
	blob, _, err := NewBundler(nil).Build(queryResp, buf, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, string(files["traffic.har"]), "host-b", "upstream returned host-b")
	require.NotContains(t, string(files["querydata.json"]), "host-b", "plugin dropped host-b")
	require.Contains(t, string(files["querydata.json"]), "host-a")
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
	bundle, _, err := NewBundler(nil).Build(nil, nil, nil, nil, nil, nil, nil)
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
	blob, _, err := NewBundler(nil).BuildDashboard(json.RawMessage(`{"title":"My dash"}`), panels)
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

func TestBuildDashboard_recordsQueryDataPerPanel(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	panels := []DashboardPanel{{
		ID:           1,
		Title:        "CPU Usage",
		QueryRequest: json.RawMessage(`{"from":"now-1h","to":"now","queries":[{"refId":"A"}]}`),
		Resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Frames: data.Frames{frame}},
		}},
	}}

	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/querydata.json")
	require.Contains(t, string(files["panels/1-cpu-usage/querydata.json"]), `"refId": "A"`)
	require.Contains(t, string(files["panels/1-cpu-usage/querydata.json"]), `42`)
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
	blob, _, err := NewBundler(nil).BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/panel.json", "top-level panel JSON resolved by id")
	require.Contains(t, files, "panels/2-logs/panel.json", "panel nested in a collapsed row resolved by id")
	require.Contains(t, string(files["panels/1-cpu-usage/panel.json"]), `"timeseries"`)
	require.Contains(t, string(files["panels/2-logs/panel.json"]), `"logs"`)
}

func TestBuildDashboard_resolvesPanelJSONFromDashboardV2Model(t *testing.T) {
	dashboardJSON := json.RawMessage(`{
		"title": "My dash",
		"elements": {
			"panel-3": {
				"kind": "Panel",
				"spec": {"id": 3, "title": "CPU Usage", "vizConfig": {"group": "timeseries"}}
			},
			"panel-4": {
				"kind": "LibraryPanel",
				"spec": {"id": 4, "title": "Shared Errors", "libraryPanel": {"uid": "shared-errors"}}
			}
		}
	}`)
	panels := []DashboardPanel{
		{ID: 3, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/3")},
		{ID: 4, Title: "Shared Errors", HARBuffer: bufferWithEntry(t, "http://ds/4")},
	}
	blob, _, err := NewBundler(nil).BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-cpu-usage/panel.json")
	require.Contains(t, files, "panels/4-shared-errors/panel.json")
	require.Contains(t, string(files["panels/3-cpu-usage/panel.json"]), `"timeseries"`)
	require.Contains(t, string(files["panels/4-shared-errors/panel.json"]), `"shared-errors"`)
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
	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
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
	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-same/traffic.har")
	require.Contains(t, files, "panels/3-same-2/traffic.har", "collision disambiguated with a numeric suffix")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 2, m.PanelsTotal)
}

// A panel whose MetricRequest can't be serialized must not abort the whole archive: the failure is
// recorded against the panel and the other panels' artifacts survive.
func TestBuildDashboard_recordsQueryRequestError(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 1, Title: "Broken request", QueryRequestErr: errors.New("unsupported value: NaN")},
		{ID: 2, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/2")},
	}
	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/2-cpu-usage/traffic.har", "the healthy panel's artifacts survive")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "serialize query request")
	require.Contains(t, m.Panels[0].QueryDataError, "unsupported value: NaN")
}

// A panel that hits two query-data failures keeps both in the manifest: the request-serialize failure
// explains the missing request, so a later response-marshal failure must not replace it.
func TestBuildDashboard_joinsQueryDataErrors(t *testing.T) {
	// Metadata that cannot be JSON-encoded makes the response marshal fail after the request already
	// failed to serialize.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	panels := []DashboardPanel{{
		ID:              1,
		Title:           "Broken both ways",
		QueryRequestErr: errors.New("request: unsupported value: +Inf"),
		Resp:            &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}
	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	// The response could not be encoded and the request never serialized, so the artifact keeps only the
	// frame summary -- but it still ships, because that summary is all the query data there is.
	queryData := string(files["panels/1-broken-both-ways/querydata.json"])
	require.Contains(t, queryData, `"responseOmitted": true`)
	require.Contains(t, queryData, `"rows": 1`)
	require.NotContains(t, queryData, `"request"`, "the request never serialized")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "serialize query request: request: unsupported value: +Inf")
	require.Contains(t, m.Panels[0].QueryDataError, "data.FrameMeta.Custom: unsupported value: NaN")
}

func TestBundler_Build_keepsRequestWhenResponseEncodingFails(t *testing.T) {
	// A response the SDK cannot encode (unserializable frame metadata) must not take a perfectly
	// serializable request down with it: that request is the query a support engineer needs most in
	// exactly the hard-to-encode cases this artifact exists for.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	request := json.RawMessage(`{"queries":[{"refId":"A","expr":"up"}]}`)

	blob, _, err := NewBundler(nil).Build(resp, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := string(files["querydata.json"])
	require.Contains(t, queryData, `"expr": "up"`, "the serializable request survives")
	require.Contains(t, queryData, `"responseOmitted": true`)
	require.Contains(t, queryData, `"responseError"`, "the encode failure is explained in the artifact")
	require.Contains(t, queryData, `"rows": 1`, "the frame summary stands in for the response")
	require.NotContains(t, queryData, `"truncated"`, "this is an encode failure, not a size truncation")

	// The failure is still recorded alongside the degraded artifact rather than swallowed by it.
	require.Contains(t, string(files["querydata-error.txt"]), "unsupported value: NaN")
}

func TestBuildDashboard_keepsRequestWhenResponseEncodingFails(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	panels := []DashboardPanel{{
		ID:           1,
		Title:        "Broken response",
		QueryRequest: json.RawMessage(`{"queries":[{"refId":"A","expr":"up"}]}`),
		Resp:         &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}
	blob, _, err := NewBundler(nil).BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := string(files["panels/1-broken-response/querydata.json"])
	require.Contains(t, queryData, `"expr": "up"`, "the serializable request survives")
	require.Contains(t, queryData, `"responseOmitted": true`)

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "unsupported value: NaN")
	require.NotZero(t, m.Panels[0].QueryDataBytes, "the surviving artifact is accounted for in the manifest")
}

// longMarshalError stands in for a plugin whose own MarshalJSON fails with a verbose message: the
// error text embedded in the artifact is plugin-controlled and can dwarf the artifact's own markers.
var longMarshalError = strings.Repeat("boom ", 400)

type failingMarshaler struct{ msg string }

func (f failingMarshaler) MarshalJSON() ([]byte, error) { return nil, errors.New(f.msg) }

func frameWithUnencodableMeta(msg string) *data.Frame {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: failingMarshaler{msg: msg}}
	return frame
}

func TestSummarizeQueryDataResponse(t *testing.T) {
	t.Run("status never reports success next to an error", func(t *testing.T) {
		// Core datasources run in-process, so nothing normalizes their status the way the SDK does on the
		// gRPC boundary; several return a bare DataResponse{Error: ...}. Reporting 200 beside an error
		// string would tell a support engineer the query succeeded.
		summaries := summarizeQueryDataResponse(&backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Error: errors.New("influxdb: parse error")},
			"B": {Frames: data.Frames{data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))}},
			"C": {Status: backend.StatusBadRequest, Error: errors.New("bad query")},
		}})

		require.Equal(t, backend.StatusUnknown, summaries["A"].Status, "an errored response must not be summarized as OK")
		require.Contains(t, summaries["A"].Error, "parse error")
		require.Equal(t, backend.StatusOK, summaries["B"].Status, "an error-free response with no status is still OK")
		require.Equal(t, backend.StatusBadRequest, summaries["C"].Status, "an explicit status is preserved")
	})

	t.Run("oversized strings are truncated and an unmeasurable frame records rows = -1", func(t *testing.T) {
		namedFrame := data.NewFrame(strings.Repeat("n", 300), data.NewField("v", nil, []float64{1}))
		namedFrame.RefID = strings.Repeat("r", 300) // truncated on its own, independently of Name
		// Mismatched field lengths make RowLen() error, which must be recorded as rows = -1.
		badRows := data.NewFrame("", data.NewField("a", nil, []int64{1, 2}), data.NewField("b", nil, []int64{1}))
		resp := backend.NewQueryDataResponse()
		resp.Responses["A"] = backend.DataResponse{
			Error:  errors.New(strings.Repeat("e", 8192)),
			Frames: data.Frames{namedFrame, badRows},
		}

		a := summarizeQueryDataResponse(resp)["A"]
		require.Len(t, a.Error, 8192, "errors are recorded whole -- the bundle budget is what bounds them now")
		require.Len(t, a.Frames[0].Name, 256+len("…"), "frame name must be truncated to 256 bytes + ellipsis")
		require.Len(t, a.Frames[0].RefID, 256+len("…"), "frame refId must be truncated to 256 bytes + ellipsis")
		require.Equal(t, -1, a.Frames[1].Rows, "a frame whose RowLen() errors must record rows = -1")
	})

	t.Run("capture frames are excluded", func(t *testing.T) {
		hcap := data.NewFrame("")
		hcap.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
		resp := backend.NewQueryDataResponse()
		resp.Responses["A"] = backend.DataResponse{Frames: data.Frames{data.NewFrame("cpu")}}
		resp.Responses["__har__A"] = backend.DataResponse{Frames: data.Frames{hcap}}

		sum := summarizeQueryDataResponse(resp)
		require.NotContains(t, sum, "__har__A", "capture frames must be excluded from the summary")
		require.Contains(t, sum, "A")
	})
}

func TestTruncateDiagnosticString(t *testing.T) {
	require.Equal(t, "", truncateDiagnosticString("", 10))
	require.Equal(t, "hello", truncateDiagnosticString("hello", 10), "under maxBytes is kept verbatim")
	require.Equal(t, "abc", truncateDiagnosticString("abc", 3), "exactly maxBytes is kept verbatim")
	require.Equal(t, "abc…", truncateDiagnosticString("abcdef", 3), "over maxBytes is byte-cut + ellipsis")

	// A single "世" is 3 bytes; a 4-byte limit lands mid-rune and must back off to the boundary.
	got := truncateDiagnosticString("世界", 4)
	require.True(t, utf8.ValidString(got), "truncation must not split a rune")
	require.Equal(t, "世…", got)
}

func TestPanelTitleSlug(t *testing.T) {
	for in, want := range map[string]string{
		"CPU Usage":             "cpu-usage",
		"a   b":                 "a-b", // runs of non-alnum collapse to one hyphen
		"--a--":                 "a",   // leading/trailing separators trimmed
		"***":                   "",    // all-symbol -> empty slug
		"Über/CPU!!!":           "ber-cpu",
		strings.Repeat("a", 50): strings.Repeat("a", 40), // capped at 40
		// A cap that lands on a separator must not leave a trailing hyphen in the directory name.
		strings.Repeat("a", 39) + " bcd": strings.Repeat("a", 39),
	} {
		require.Equalf(t, want, panelTitleSlug(in), "panelTitleSlug(%q)", in)
	}
	// An empty slug means the panel dir has no title suffix.
	require.Equal(t, "panels/7", uniquePanelDir(7, "***", map[string]bool{}))
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

func TestBundler_Build_bundlesPanelData(t *testing.T) {
	panelData := json.RawMessage(`{"version":1,"frames":[{"schema":{"name":"frontend-frames"}}]}`)

	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, nil, nil, nil, nil, nil,
		WithPanelData(panelData))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Equal(t, string(panelData), string(files["paneldata.json"]), "stored as sent")
}

func TestBundler_Build_omitsPanelDataWhenNotSupplied(t *testing.T) {
	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	require.NotContains(t, readTarGz(t, blob), "paneldata.json")
}

func TestBundler_Build_omitsPanelDataWhenNull(t *testing.T) {
	// A client that sends "panelData": null supplied nothing, so no artifact: one whose whole content is
	// `null` reads as "the frontend was holding no frames", which is a frontend loss that never happened.
	for _, payload := range []string{`null`, ` null `, ``} {
		blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, nil, nil, nil, nil, nil,
			WithPanelData(json.RawMessage(payload)))
		require.NoError(t, err)

		require.NotContains(t, readTarGz(t, blob), "paneldata.json", "payload %q", payload)
	}
}

func TestBundler_Build_unparseablePanelDataDoesNotSinkTheBundle(t *testing.T) {
	// Build stores the payload as sent and parses none of it, so a payload it could not parse costs the
	// bundle nothing else: every other artifact still ships. Unreachable through the HTTP endpoint --
	// web.Bind rejects a body that isn't valid JSON before Build runs, so the worst that arrives there is
	// a well-formed payload of the wrong shape -- this pins the contract for direct callers.
	blob, _, err := NewBundler(nil).Build(nil, &harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil, nil, nil,
		WithPanelData(json.RawMessage(`{"version":1,`)))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panel.json")
	require.Equal(t, `{"version":1,`, string(files["paneldata.json"]), "stored as sent")
}

func TestBundleBudget_dropsOversizedArtifactsWhole(t *testing.T) {
	budget := newBundleBudget()

	require.True(t, budget.add("small.json", []byte("{}")))
	require.False(t, budget.add("huge.har", make([]byte, MaxBundleBytes+1)),
		"an artifact larger than the whole budget must not fit")
	require.True(t, budget.add("also-small.txt", []byte("still room")),
		"a rejected artifact must not consume budget, so later ones still fit")

	archive, result, err := budget.finish()
	require.NoError(t, err)
	require.True(t, result.Partial())
	require.Len(t, result.Dropped, 1)
	require.Contains(t, result.Dropped[0], "huge.har")

	files := readTarGz(t, archive)
	require.Contains(t, files, "small.json")
	require.Contains(t, files, "also-small.txt")
	require.NotContains(t, files, "huge.har", "an over-budget artifact must be dropped whole, not clipped")
	require.Contains(t, string(files["bundle-limit.txt"]), "huge.har",
		"a dropped artifact must be named, so its absence isn't read as nothing-to-capture")
}

func TestBundleBudget_completeBundleIsUnmarked(t *testing.T) {
	budget := newBundleBudget()
	require.True(t, budget.add("traffic.har", []byte(`{"log":{}}`)))

	archive, result, err := budget.finish()
	require.NoError(t, err)
	require.False(t, result.Partial())
	require.NotContains(t, readTarGz(t, archive), "bundle-limit.txt",
		"a bundle that dropped nothing must carry no limit note")
}

func TestQueryDataLowerBoundBytes(t *testing.T) {
	t.Run("nil and empty responses cost nothing", func(t *testing.T) {
		require.Zero(t, queryDataLowerBoundBytes(nil))
		require.Zero(t, queryDataLowerBoundBytes(backend.NewQueryDataResponse()))
	})

	t.Run("numeric fields are floored at one byte per value", func(t *testing.T) {
		frame := data.NewFrame("cpu",
			data.NewField("a", nil, []float64{1, 2, 3}),
			data.NewField("b", nil, []int64{1, 2, 3}),
		)
		resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
		require.Equal(t, 6, queryDataLowerBoundBytes(resp), "two fields of three values")
	})

	t.Run("string fields count their bytes plus quotes", func(t *testing.T) {
		frame := data.NewFrame("logs", data.NewField("line", nil, []string{"hello", "hi"}))
		resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
		require.Equal(t, len(`"hello"`)+len(`"hi"`), queryDataLowerBoundBytes(resp))
	})

	t.Run("HAR frames are excluded, as the artifact excludes them", func(t *testing.T) {
		payload := data.NewFrame("har", data.NewField("line", nil, []string{strings.Repeat("x", 1000)}))
		resp := &backend.QueryDataResponse{Responses: backend.Responses{
			harResponseRefIDPrefix + "abc": {Frames: data.Frames{payload}},
		}}
		require.Zero(t, queryDataLowerBoundBytes(resp),
			"counting bytes the artifact won't contain is the one way this could overestimate")
	})

	// The whole point: the floor must never exceed the real encoding, or a response that would have fitted
	// gets declined and its evidence is lost.
	t.Run("the floor never exceeds the real encoded size", func(t *testing.T) {
		for _, tc := range []struct {
			name  string
			frame *data.Frame
		}{
			{"numbers", data.NewFrame("n", data.NewField("v", nil, []float64{1.5, -2.25, 3}))},
			{"strings", data.NewFrame("s", data.NewField("v", nil, []string{"", "a", "hello world"}))},
			{"nullable strings", data.NewFrame("ns", data.NewField("v", nil, []*string{nil, ptr("x")}))},
			{"mixed", data.NewFrame("m",
				data.NewField("t", nil, []time.Time{time.Unix(0, 0)}),
				data.NewField("v", nil, []string{"payload"}),
			)},
			{"empty frame", data.NewFrame("e", data.NewField("v", nil, []float64{}))},
		} {
			t.Run(tc.name, func(t *testing.T) {
				resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{tc.frame}}}}
				encoded, err := marshalQueryDataArtifact(nil, resp)
				require.NoError(t, err)
				require.LessOrEqual(t, queryDataLowerBoundBytes(resp), len(encoded),
					"the floor must be a lower bound on the real artifact")
			})
		}
	})
}

func ptr[T any](v T) *T { return &v }

func TestBundler_Build_declinesQueryDataItCannotFit(t *testing.T) {
	// A string field larger than the whole budget: the floor alone exceeds it, so the response must never
	// be marshalled -- avoiding the allocation is the reason the check exists.
	huge := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", MaxBundleBytes+1)}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{huge}}}}

	archive, result, err := NewBundler(nil).Build(resp, nil, nil, nil, json.RawMessage(`{"q":1}`), nil, nil)
	require.NoError(t, err)
	require.True(t, result.Partial())

	files := readTarGz(t, archive)
	require.NotContains(t, files, "querydata.json")
	require.Contains(t, string(files["bundle-limit.txt"]), "not built",
		"the reader must be able to tell it was declined rather than absent")
	require.Contains(t, string(files["querydata-error.txt"]), "larger than the bundle size limit")
}
