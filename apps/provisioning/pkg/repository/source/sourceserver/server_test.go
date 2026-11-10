package sourceserver_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
)

// These tests read the wire with encoding/json, independent of the protobuf JSON mapping
// the client uses, so they pin the contract in the issue rather than the generated code.

type wire struct {
	t    *testing.T
	base string
}

func newWire(t *testing.T, opts sourceserver.Options, files map[string][]byte) (*wire, *sourceserver.Server) {
	t.Helper()
	opts.ID = "stacks-1"
	srv := sourceserver.New(opts)
	srv.Publish(files)
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return &wire{t: t, base: ts.URL + "/v1/sources/stacks-1"}, srv
}

// reply is a response whose body has already been read and closed.
type reply struct {
	StatusCode int
	Header     http.Header
}

func (w *wire) get(path string, header ...string) (reply, []byte) {
	w.t.Helper()
	req, err := http.NewRequestWithContext(w.t.Context(), http.MethodGet, w.base+path, nil)
	require.NoError(w.t, err)
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(w.t, err)
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	require.NoError(w.t, err)
	return reply{StatusCode: resp.StatusCode, Header: resp.Header}, body
}

func (w *wire) json(path string, header ...string) (int, map[string]any) {
	w.t.Helper()
	resp, body := w.get(path, header...)
	var out map[string]any
	require.NoError(w.t, json.Unmarshal(body, &out), string(body))
	return resp.StatusCode, out
}

func TestWireDescriptor(t *testing.T) {
	files := map[string][]byte{"a.yaml": []byte("a")}

	t.Run("tier 0 advertises no optional capability", func(t *testing.T) {
		w, _ := newWire(t, sourceserver.Options{Tier: sourceserver.TierTree}, files)
		resp, _ := w.get("")
		assert.Equal(t, "max-age=300", resp.Header.Get("Cache-Control"))

		status, got := w.json("")
		assert.Equal(t, http.StatusOK, status)
		assert.Equal(t, "source.grafana.app/v1", got["apiVersion"])
		assert.Equal(t, "stacks-1", got["id"])

		caps := got["capabilities"].(map[string]any)
		assert.Equal(t, []any{"inline"}, caps["secrets"])
		assert.NotContains(t, caps, "history", "an unset message is omitted, not null")
		assert.Equal(t, false, caps["revision"])

		limits := got["limits"].(map[string]any)
		assert.Equal(t, float64(5<<20), limits["maxFileBytes"], "sizes are JSON numbers, not strings")
	})

	t.Run("tier 3 advertises everything", func(t *testing.T) {
		w, _ := newWire(t, sourceserver.Options{Tier: sourceserver.TierCompare, Retained: 5}, files)
		_, got := w.json("")

		caps := got["capabilities"].(map[string]any)
		assert.Equal(t, true, caps["revision"])
		assert.Equal(t, true, caps["compare"])
		assert.Equal(t, map[string]any{"retained": float64(5)}, caps["history"])
	})
}

func TestWireRevisionIsConditional(t *testing.T) {
	w, _ := newWire(t, sourceserver.Options{Tier: sourceserver.TierRevision}, map[string][]byte{"a.yaml": []byte("a")})

	resp, body := w.get("/revision")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	etag := resp.Header.Get("ETag")
	require.NotEmpty(t, etag)

	var got map[string]any
	require.NoError(t, json.Unmarshal(body, &got))
	assert.Equal(t, etag, `"`+got["revision"].(string)+`"`)

	resp, body = w.get("/revision", "If-None-Match", etag)
	assert.Equal(t, http.StatusNotModified, resp.StatusCode)
	assert.Empty(t, body)

	resp, _ = w.get("/revision", "If-None-Match", `"stale0000"`)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestWireTree(t *testing.T) {
	w, _ := newWire(t, sourceserver.Options{MaxPageSize: 2}, map[string][]byte{
		"a.yaml": []byte("aaa"), "b.yaml": []byte("bb"), "c.yaml": []byte("c"),
	})

	status, first := w.json("/tree")
	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, false, first["complete"], "false stays on the wire")
	assert.NotEmpty(t, first["revision"])

	entries := first["entries"].([]any)
	require.Len(t, entries, 2)
	entry := entries[0].(map[string]any)
	assert.Equal(t, "a.yaml", entry["path"])
	assert.Equal(t, float64(3), entry["size"], "size is a JSON number")
	assert.Len(t, entry["hash"], 64)

	_, last := w.json("/tree?revision=" + first["revision"].(string) + "&cursor=" + first["nextCursor"].(string))
	assert.Equal(t, true, last["complete"])
	assert.Len(t, last["entries"], 1)
	assert.Empty(t, last["nextCursor"])
}

func TestWireFile(t *testing.T) {
	w, _ := newWire(t, sourceserver.Options{}, map[string][]byte{"dashboards/team/a.yaml": []byte("title: a\n")})

	_, tree := w.json("/tree")
	hash := tree["entries"].([]any)[0].(map[string]any)["hash"]

	resp, body := w.get("/files/dashboards/team/a.yaml")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "title: a\n", string(body), "raw bytes, not JSON")
	assert.Equal(t, `"`+hash.(string)+`"`, resp.Header.Get("ETag"), "ETag equals the tree hash")
	assert.Equal(t, "no-store", resp.Header.Get("Cache-Control"))
}

func TestWireCompare(t *testing.T) {
	w, srv := newWire(t, sourceserver.Options{Tier: sourceserver.TierCompare}, map[string][]byte{"a.yaml": []byte("1"), "gone.yaml": []byte("x")})
	_, before := w.json("/tree")
	head := srv.Publish(map[string][]byte{"a.yaml": []byte("2"), "new.yaml": []byte("n")})

	status, got := w.json("/compare?base=" + before["revision"].(string) + "&head=" + head)
	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, true, got["complete"])
	assert.Equal(t, []any{
		map[string]any{"action": "updated", "path": "a.yaml", "previousPath": ""},
		map[string]any{"action": "deleted", "path": "gone.yaml", "previousPath": ""},
		map[string]any{"action": "created", "path": "new.yaml", "previousPath": ""},
	}, got["changes"])
}

func TestWireErrors(t *testing.T) {
	w, srv := newWire(t, sourceserver.Options{Tier: sourceserver.TierRevision, Token: "tok"}, map[string][]byte{"a.yaml": []byte("1")})

	t.Run("missing token", func(t *testing.T) {
		status, got := w.json("")
		assert.Equal(t, http.StatusUnauthorized, status)
		assert.Equal(t, map[string]any{"code": "unauthorized", "message": "invalid or missing token", "retryable": false}, got)
	})

	authed := func(path string) (int, map[string]any) {
		resp, body := w.get(path, "Authorization", "Bearer tok")
		var got map[string]any
		require.NoError(t, json.Unmarshal(body, &got), string(body))
		return resp.StatusCode, got
	}

	tests := []struct {
		name   string
		path   string
		status int
		code   string
	}{
		{"unknown file", "/files/nope.yaml", http.StatusNotFound, "file_not_found"},
		{"unknown revision", "/tree?revision=neverseen1", http.StatusNotFound, "revision_not_found"},
		{"compare not advertised", "/compare?base=a&head=b", http.StatusNotImplemented, "not_supported"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, got := authed(tt.path)
			assert.Equal(t, tt.status, status)
			assert.Equal(t, tt.code, got["code"])
			assert.NotEmpty(t, got["message"])
		})
	}

	t.Run("an evicted revision is gone", func(t *testing.T) {
		_, first := authed("/tree")
		srv.Publish(map[string][]byte{"a.yaml": []byte("2")}) // tier revision keeps only one
		status, got := authed("/tree?revision=" + first["revision"].(string))
		assert.Equal(t, http.StatusGone, status)
		assert.Equal(t, "revision_gone", got["code"])
	})

	t.Run("a malformed query is a bad request", func(t *testing.T) {
		w2, _ := newWire(t, sourceserver.Options{}, nil)
		status, got := w2.json("/tree?limit=notanumber")
		assert.Equal(t, http.StatusBadRequest, status)
		assert.Equal(t, "bad_request", got["code"])
		assert.Equal(t, false, got["retryable"])
	})
}
