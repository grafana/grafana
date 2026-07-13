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

func TestBundler_Build_redactsQueryErrorURL(t *testing.T) {
	// A transport error embedding a URL with a secret query param must not leak into query-error.txt.
	err := errors.New(`Get "https://ds.example.com/api?api_key=SECRET": dial tcp: connection refused`)
	blob, buildErr := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, err)
	require.NoError(t, buildErr)

	files := readTarGz(t, blob)
	require.Contains(t, files, "query-error.txt")
	got := string(files["query-error.txt"])
	require.NotContains(t, got, "SECRET", "secret query param must be redacted from query-error.txt")
	require.Contains(t, got, "connection refused", "error message otherwise preserved")
}

func TestMergeHAR(t *testing.T) {
	d1 := []byte(`{"log":{"creator":{"name":"A","version":"1"},"entries":[{"n":1}]}}`)
	d2 := []byte(`{"log":{"entries":[{"n":2},{"n":3}]}}`)
	malformed := []byte(`not json`)

	out := mergeHAR([][]byte{d1, malformed, d2})
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

	require.Nil(t, mergeHAR([][]byte{malformed}), "no parseable entries -> nil")
	require.Nil(t, mergeHAR(nil))
}

func TestHasCapturedHAR(t *testing.T) {
	require.False(t, HasCapturedHAR(nil, &harcapture.Buffer{}), "no buffer entries, no response")
	require.False(t, HasCapturedHAR(&backend.QueryDataResponse{Responses: backend.Responses{}}, &harcapture.Buffer{}))

	// An external __har__ frame counts as captured even when the in-process buffer is empty — the
	// handler must not short-circuit a failed query away in that case.
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}
	require.True(t, HasCapturedHAR(resp, &harcapture.Buffer{}))
}

func TestCollectHAR_ExternalFramesAndNilFrame(t *testing.T) {
	// A frame with a secret in a request header — it must be redacted when merged, not passed verbatim.
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
	require.NotContains(t, string(out), "FRAMESECRET", "external-plugin frame headers must be redacted before merge")

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
