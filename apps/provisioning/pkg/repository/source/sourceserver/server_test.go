package sourceserver_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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

// send is get with a method and a body.
func (w *wire) send(method, path string, body string, header ...string) (reply, []byte) {
	w.t.Helper()
	req, err := http.NewRequestWithContext(w.t.Context(), method, w.base+path, strings.NewReader(body))
	require.NoError(w.t, err)
	if method == http.MethodPut {
		req.Header.Set("Content-Type", "application/octet-stream")
	}
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(w.t, err)
	defer func() { _ = resp.Body.Close() }()
	data, err := io.ReadAll(resp.Body)
	require.NoError(w.t, err)
	return reply{StatusCode: resp.StatusCode, Header: resp.Header}, data
}

func (w *wire) content(path string) (int, string) {
	w.t.Helper()
	resp, body := w.get("/files/" + path)
	return resp.StatusCode, string(body)
}

func errorCode(t *testing.T, body []byte) string {
	t.Helper()
	var e map[string]any
	require.NoError(t, json.Unmarshal(body, &e), string(body))
	return e["code"].(string)
}

func TestWireWriteIsAdvertisedOnlyWhenServed(t *testing.T) {
	for _, writable := range []bool{false, true} {
		w, _ := newWire(t, sourceserver.Options{Writable: writable}, nil)
		_, got := w.json("")
		assert.Equal(t, writable, got["capabilities"].(map[string]any)["write"], "writable=%v", writable)
	}

	t.Run("a source that is not writable answers 501", func(t *testing.T) {
		w, _ := newWire(t, sourceserver.Options{}, map[string][]byte{"a.yaml": []byte("a")})
		resp, body := w.send(http.MethodPut, "/files/b.yaml", "b")
		assert.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		assert.Equal(t, "not_supported", errorCode(t, body))

		resp, _ = w.send(http.MethodDelete, "/files/a.yaml", "")
		assert.Equal(t, http.StatusNotImplemented, resp.StatusCode)
		resp, _ = w.send(http.MethodPost, "/move", `{"from":"a.yaml","to":"c.yaml"}`)
		assert.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestWirePutFile(t *testing.T) {
	w, srv := newWire(t, sourceserver.Options{Writable: true, Tier: sourceserver.TierCompare}, map[string][]byte{"a.yaml": []byte("one")})
	before := srv.Publish(map[string][]byte{"a.yaml": []byte("one")})

	t.Run("creating answers 201 with the new version", func(t *testing.T) {
		resp, body := w.send(http.MethodPut, "/files/dashboards/b.yaml?message=add+b", "bee", "If-None-Match", "*")
		require.Equal(t, http.StatusCreated, resp.StatusCode, string(body))
		assert.NotEmpty(t, resp.Header.Get("ETag"))

		var mutation map[string]any
		require.NoError(t, json.Unmarshal(body, &mutation))
		assert.NotEqual(t, before, mutation["revision"], "an edit is a new revision")

		status, content := w.content("dashboards/b.yaml")
		assert.Equal(t, http.StatusOK, status)
		assert.Equal(t, "bee", content)
	})

	t.Run("create-only refuses an existing file", func(t *testing.T) {
		resp, body := w.send(http.MethodPut, "/files/a.yaml", "other", "If-None-Match", "*")
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
		assert.Equal(t, "already_exists", errorCode(t, body))
		_, content := w.content("a.yaml")
		assert.Equal(t, "one", content, "nothing was written")
	})

	t.Run("replace-only refuses a missing file", func(t *testing.T) {
		resp, body := w.send(http.MethodPut, "/files/missing.yaml", "x", "If-Match", "*")
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Equal(t, "file_not_found", errorCode(t, body))
	})

	t.Run("a write conditioned on a version only replaces that version", func(t *testing.T) {
		resp, _ := w.get("/files/a.yaml")
		version := resp.Header.Get("ETag")

		stale, body := w.send(http.MethodPut, "/files/a.yaml", "two", "If-Match", `"0000"`)
		assert.Equal(t, http.StatusPreconditionFailed, stale.StatusCode, string(body))
		assert.Equal(t, "precondition_failed", errorCode(t, body))

		ok, _ := w.send(http.MethodPut, "/files/a.yaml", "two", "If-Match", version)
		assert.Equal(t, http.StatusOK, ok.StatusCode)
		_, content := w.content("a.yaml")
		assert.Equal(t, "two", content)

		again, _ := w.send(http.MethodPut, "/files/a.yaml", "three", "If-Match", version)
		assert.Equal(t, http.StatusPreconditionFailed, again.StatusCode, "the version it was based on is gone")
	})

	t.Run("without a condition the file is written", func(t *testing.T) {
		resp, _ := w.send(http.MethodPut, "/files/c.json", "{}")
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		resp, _ = w.send(http.MethodPut, "/files/c.json", `{"a":1}`)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("a directory marker is a file", func(t *testing.T) {
		resp, _ := w.send(http.MethodPut, "/files/empty/.keep", "")
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("paths are checked", func(t *testing.T) {
		for _, bad := range []string{"notes.txt", "a/../b.yaml", "a//b.yaml"} {
			resp, body := w.send(http.MethodPut, "/files/"+bad, "x")
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode, bad)
			assert.Equal(t, "bad_request", errorCode(t, body), bad)
		}
	})
}

func TestWireDeleteAndMove(t *testing.T) {
	seed := map[string][]byte{
		"a.yaml": []byte("a"), "dir/x.yaml": []byte("x"), "dir/sub/y.yaml": []byte("y"), "other/z.yaml": []byte("z"),
	}
	fresh := func(t *testing.T) *wire {
		t.Helper()
		w, _ := newWire(t, sourceserver.Options{Writable: true}, seed)
		return w
	}
	paths := func(w *wire) []string {
		_, tree := w.json("/tree")
		entries := tree["entries"].([]any)
		out := make([]string, 0, len(entries))
		for _, e := range entries {
			out = append(out, e.(map[string]any)["path"].(string))
		}
		return out
	}

	t.Run("delete a file", func(t *testing.T) {
		w := fresh(t)
		resp, _ := w.send(http.MethodDelete, "/files/a.yaml", "")
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.NotContains(t, paths(w), "a.yaml")
	})
	t.Run("delete a missing file", func(t *testing.T) {
		resp, body := fresh(t).send(http.MethodDelete, "/files/nope.yaml", "")
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
		assert.Equal(t, "file_not_found", errorCode(t, body))
	})
	t.Run("a directory needs recursive", func(t *testing.T) {
		w := fresh(t)
		resp, _ := w.send(http.MethodDelete, "/files/dir", "")
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		resp, _ = w.send(http.MethodDelete, "/files/dir?recursive=true", "")
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, []string{"a.yaml", "other/z.yaml"}, paths(w), "everything under it, and nothing else")
	})

	t.Run("move a file", func(t *testing.T) {
		w := fresh(t)
		resp, _ := w.send(http.MethodPost, "/move", `{"from":"a.yaml","to":"renamed/a.yaml"}`)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Contains(t, paths(w), "renamed/a.yaml")
		assert.NotContains(t, paths(w), "a.yaml")
	})
	t.Run("move a directory in one revision", func(t *testing.T) {
		w := fresh(t)
		_, before := w.json("/revision")
		_ = before
		resp, body := w.send(http.MethodPost, "/move", `{"from":"dir/","to":"moved/"}`)
		require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
		assert.Equal(t, []string{"a.yaml", "moved/sub/y.yaml", "moved/x.yaml", "other/z.yaml"}, paths(w))
	})
	t.Run("the destination must not exist", func(t *testing.T) {
		w := fresh(t)
		resp, body := w.send(http.MethodPost, "/move", `{"from":"a.yaml","to":"other/z.yaml"}`)
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
		assert.Equal(t, "already_exists", errorCode(t, body))
		assert.Contains(t, paths(w), "a.yaml", "nothing moved")
	})
	t.Run("moving a missing source", func(t *testing.T) {
		resp, _ := fresh(t).send(http.MethodPost, "/move", `{"from":"nope.yaml","to":"x.yaml"}`)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
	t.Run("a file cannot become a directory", func(t *testing.T) {
		resp, _ := fresh(t).send(http.MethodPost, "/move", `{"from":"a.yaml","to":"dir/"}`)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
