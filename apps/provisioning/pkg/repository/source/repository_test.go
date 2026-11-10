package source_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	sourceID = "stacks-1"
	token    = "s3cret"
)

type fakeSecure struct{ token common.RawSecureValue }

func (f fakeSecure) Token(context.Context) (common.RawSecureValue, error) { return f.token, nil }
func (fakeSecure) WebhookSecret(context.Context) (common.RawSecureValue, error) {
	return "", nil
}
func (fakeSecure) CommitSigningKey(context.Context) (common.RawSecureValue, error) {
	return "", nil
}

func fakeDecrypter(r *provisioning.Repository) repository.SecureValues {
	return fakeSecure{r.Secure.Token.Create}
}

func newExtra() repository.Extra {
	return source.Extra(fakeDecrypter, true, nil)
}

// requests records "<endpoint>:<status>" for every call that reaches the server.
type requests struct {
	mu   sync.Mutex
	seen []string
}

func (r *requests) record(s string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.seen = append(r.seen, s)
}

func (r *requests) take() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := r.seen
	r.seen = nil
	return out
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// startSource serves a reference source and returns its URL plus a request log.
func startSource(t *testing.T, opts sourceserver.Options, files map[string][]byte) (*sourceserver.Server, string, *requests) {
	t.Helper()

	opts.ID = sourceID
	if opts.Token == "" {
		opts.Token = token
	}
	srv := sourceserver.New(opts)
	srv.Publish(files)

	log := &requests{}
	inner := srv.Handler()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		inner.ServeHTTP(sw, r)
		// "/v1/sources/<id>/files/a.yaml" is recorded as "/files".
		endpoint := "/"
		if parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/v1/sources/"), "/", 3); len(parts) > 1 {
			endpoint += parts[1]
		}
		log.record(endpoint + ":" + http.StatusText(sw.status))
	}))
	t.Cleanup(ts.Close)
	return srv, ts.URL + "/v1/sources/" + sourceID, log
}

func build(t *testing.T, url, tok string) repository.Repository {
	t.Helper()

	repo, err := buildErr(newExtra(), url, tok)
	require.NoError(t, err)
	return repo
}

func buildErr(e repository.Extra, url, tok string) (repository.Repository, error) {
	return e.Build(context.Background(), &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "src", Namespace: "stacks-1"},
		Spec: provisioning.RepositorySpec{
			Type:   provisioning.SourceRepositoryType,
			Source: &provisioning.SourceRepositoryConfig{URL: url},
		},
		Secure: provisioning.SecureValues{Token: common.InlineSecureValue{Create: common.RawSecureValue(tok)}},
	})
}

func manifests(kv ...string) map[string][]byte {
	out := map[string][]byte{}
	for i := 0; i+1 < len(kv); i += 2 {
		out[kv[i]] = []byte(kv[i+1])
	}
	return out
}

func TestReadTree(t *testing.T) {
	files := manifests(
		"plugin.grafana-irm-app.yaml", "plugin",
		"dashboards/team/a.yaml", "a",
		"dashboards/team/deep/b.yaml", "b",
		".hidden/c.yaml", "hidden",
		"dashboards/empty/.keep", "",
	)
	// Page size 2 forces the client through the cursor.
	_, url, _ := startSource(t, sourceserver.Options{MaxPageSize: 2}, files)

	tree, err := build(t, url, token).(repository.Reader).ReadTree(context.Background(), "")
	require.NoError(t, err)

	got := map[string]bool{}
	for _, e := range tree {
		got[e.Path] = e.Blob
		if e.Blob {
			assert.NotEmpty(t, e.Hash, e.Path)
			if !strings.HasSuffix(e.Path, ".keep") {
				assert.NotZero(t, e.Size, e.Path)
			}
		}
	}
	assert.Equal(t, map[string]bool{
		"plugin.grafana-irm-app.yaml": true,
		"dashboards/":                 false,
		"dashboards/team/":            false,
		"dashboards/team/a.yaml":      true,
		"dashboards/team/deep/":       false,
		"dashboards/team/deep/b.yaml": true,
		"dashboards/empty/":           false,
		"dashboards/empty/.keep":      true,
	}, got)
}

func TestRead(t *testing.T) {
	srv, url, _ := startSource(t, sourceserver.Options{Tier: sourceserver.TierHistory}, manifests("a.yaml", "v1"))
	rev1 := srv.Publish(manifests("a.yaml", "v1"))
	srv.Publish(manifests("a.yaml", "v2"))

	repo := build(t, url, token).(repository.Reader)

	t.Run("current", func(t *testing.T) {
		info, err := repo.Read(context.Background(), "a.yaml", "")
		require.NoError(t, err)
		assert.Equal(t, "v2", string(info.Data))
		assert.NotEmpty(t, info.Hash)
	})
	t.Run("at a retained revision", func(t *testing.T) {
		info, err := repo.Read(context.Background(), "a.yaml", rev1)
		require.NoError(t, err)
		assert.Equal(t, "v1", string(info.Data))
		assert.Equal(t, rev1, info.Ref)
	})
	t.Run("missing file", func(t *testing.T) {
		_, err := repo.Read(context.Background(), "nope.yaml", "")
		assert.ErrorIs(t, err, repository.ErrFileNotFound)
	})
	t.Run("malformed ref", func(t *testing.T) {
		_, err := repo.Read(context.Background(), "a.yaml", "../etc")
		assert.ErrorIs(t, err, repository.ErrInvalidRef)
	})
	t.Run("directories are implicit", func(t *testing.T) {
		info, err := repo.Read(context.Background(), "dashboards/", "")
		require.NoError(t, err)
		assert.Empty(t, info.Data)
	})
}

func TestCapabilityTiers(t *testing.T) {
	tests := []struct {
		tier      sourceserver.Tier
		versioned bool
	}{
		{sourceserver.TierTree, false},
		{sourceserver.TierRevision, true},
		{sourceserver.TierHistory, true},
		{sourceserver.TierCompare, true},
	}
	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			_, url, _ := startSource(t, sourceserver.Options{Tier: tt.tier}, manifests("a.yaml", "a"))
			_, ok := build(t, url, token).(repository.Versioned)
			assert.Equal(t, tt.versioned, ok, "tier %d", tt.tier)
		})
	}
}

func TestLatestRefIsOneConditionalRequestWhenIdle(t *testing.T) {
	srv, url, log := startSource(t, sourceserver.Options{Tier: sourceserver.TierRevision}, manifests("a.yaml", "a"))
	e := newExtra()
	r, err := buildErr(e, url, token)
	require.NoError(t, err)
	repo := r.(repository.Versioned)
	log.take() // descriptor

	first, err := repo.LatestRef(context.Background())
	require.NoError(t, err)
	assert.Equal(t, []string{"/revision:OK"}, log.take())

	// A new repository value, as the controller builds one per reconcile, shares the cache.
	r, err = buildErr(e, url, token)
	require.NoError(t, err)
	repo = r.(repository.Versioned)
	assert.Empty(t, log.take(), "descriptor is cached")

	again, err := repo.LatestRef(context.Background())
	require.NoError(t, err)
	assert.Equal(t, first, again)
	assert.Equal(t, []string{"/revision:Not Modified"}, log.take())

	next := srv.Publish(manifests("a.yaml", "changed"))
	changed, err := repo.LatestRef(context.Background())
	require.NoError(t, err)
	assert.Equal(t, next, changed)
	assert.NotEqual(t, first, changed)
}

func TestCompareFiles(t *testing.T) {
	before := manifests(
		"plugin.keep.yaml", "same",
		"plugin.change.yaml", "old",
		"datasource.gone.yaml", "gone",
		"dashboards/f/a.yaml", "a",
	)
	after := manifests(
		"plugin.keep.yaml", "same",
		"plugin.change.yaml", "new",
		"setting.added.yaml", "added",
		"dashboards/f/a.yaml", "a",
	)

	// A source that only keeps history is diffed client side; one with compare does it server side.
	// Both must hand Provisioning the same change list.
	for name, tier := range map[string]sourceserver.Tier{"history": sourceserver.TierHistory, "compare": sourceserver.TierCompare} {
		t.Run(name, func(t *testing.T) {
			srv, url, _ := startSource(t, sourceserver.Options{Tier: tier}, before)
			base := srv.Publish(before)
			head := srv.Publish(after)

			changes, err := build(t, url, token).(repository.Versioned).CompareFiles(context.Background(), base, head)
			require.NoError(t, err)

			assert.ElementsMatch(t, []repository.VersionedFileChange{
				{Action: repository.FileActionUpdated, Path: "plugin.change.yaml", Ref: head, PreviousRef: base},
				{Action: repository.FileActionCreated, Path: "setting.added.yaml", Ref: head},
				{Action: repository.FileActionDeleted, Path: "datasource.gone.yaml", PreviousPath: "datasource.gone.yaml", Ref: head, PreviousRef: base},
			}, changes)
		})
	}

	t.Run("a source without history cannot be compared", func(t *testing.T) {
		srv, url, _ := startSource(t, sourceserver.Options{Tier: sourceserver.TierRevision}, before)
		base := srv.Publish(before)
		head := srv.Publish(after)

		_, err := build(t, url, token).(repository.Versioned).CompareFiles(context.Background(), base, head)
		assert.ErrorIs(t, err, source.ErrNotSupported)
	})

	t.Run("an evicted base is a ref error so the controller falls back to a full sync", func(t *testing.T) {
		srv, url, _ := startSource(t, sourceserver.Options{Tier: sourceserver.TierCompare, Retained: 2}, before)
		base := srv.Publish(before)
		srv.Publish(after)
		head := srv.Publish(manifests("another.yaml", "x"))

		_, err := build(t, url, token).(repository.Versioned).CompareFiles(context.Background(), base, head)
		assert.ErrorIs(t, err, repository.ErrRefNotFound)
	})
}

func TestTreePinsItsRevisionAcrossPages(t *testing.T) {
	original := manifests("a.yaml", "a", "b.yaml", "b", "c.yaml", "c")
	moved := manifests("a.yaml", "a", "b.yaml", "b", "c.yaml", "c", "z.yaml", "z")

	// The source moves right after it serves the first page.
	serve := func(t *testing.T, tier sourceserver.Tier) string {
		srv := sourceserver.New(sourceserver.Options{ID: sourceID, Tier: tier, MaxPageSize: 2})
		srv.Publish(original)
		inner := srv.Handler()
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			inner.ServeHTTP(w, r)
			if r.URL.Query().Get("cursor") == "" && r.URL.Path == "/v1/sources/"+sourceID+"/tree" {
				srv.Publish(moved)
			}
		}))
		t.Cleanup(ts.Close)
		return ts.URL + "/v1/sources/" + sourceID
	}

	t.Run("a source with history serves one consistent snapshot", func(t *testing.T) {
		tree, err := build(t, serve(t, sourceserver.TierHistory), "").(repository.Reader).ReadTree(context.Background(), "")
		require.NoError(t, err)

		paths := make([]string, 0, len(tree))
		for _, e := range tree {
			paths = append(paths, e.Path)
		}
		assert.Equal(t, []string{"a.yaml", "b.yaml", "c.yaml"}, paths)
	})

	t.Run("a source that cannot serve the pinned revision answers gone", func(t *testing.T) {
		_, err := build(t, serve(t, sourceserver.TierRevision), "").(repository.Reader).ReadTree(context.Background(), "")
		assert.ErrorIs(t, err, repository.ErrRefNotFound)
	})
}

func TestFailures(t *testing.T) {
	files := manifests("a.yaml", "a")

	t.Run("bad token", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, files)
		_, err := buildErr(newExtra(), url, "wrong")
		assert.ErrorIs(t, err, repository.ErrUnauthorized)
	})

	t.Run("unknown source id", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, files)
		_, err := buildErr(newExtra(), url[:len(url)-len(sourceID)]+"other", token)
		assert.ErrorIs(t, err, source.ErrSourceNotFound)
	})

	t.Run("redirects are not followed", func(t *testing.T) {
		var followed bool
		target := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { followed = true }))
		t.Cleanup(target.Close)
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, target.URL, http.StatusFound)
		}))
		t.Cleanup(ts.Close)

		_, err := buildErr(newExtra(), ts.URL+"/v1/sources/x", token)
		assert.Error(t, err)
		assert.False(t, followed)
	})

	t.Run("an incomplete tree is refused", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			if r.URL.Path == "/v1/sources/"+sourceID+"/tree" {
				_, _ = w.Write([]byte(`{"revision":"abcdefgh","complete":false,"entries":[]}`))
				return
			}
			_, _ = w.Write([]byte(`{"apiVersion":"` + sourcev1.APIVersion + `","id":"` + sourceID + `"}`))
		}))
		t.Cleanup(ts.Close)

		_, err := build(t, ts.URL+"/v1/sources/"+sourceID, "").(repository.Reader).ReadTree(context.Background(), "")
		assert.ErrorIs(t, err, source.ErrIncompleteTree)
	})

	t.Run("an invalid path from the source fails the read", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, manifests("notes.txt", "x"))
		_, err := build(t, url, token).(repository.Reader).ReadTree(context.Background(), "")
		assert.ErrorContains(t, err, "invalid path")
	})
}

func TestTest(t *testing.T) {
	_, url, _ := startSource(t, sourceserver.Options{}, manifests("a.yaml", "a"))

	t.Run("healthy", func(t *testing.T) {
		res, err := build(t, url, token).Test(context.Background())
		require.NoError(t, err)
		assert.True(t, res.Success)
		assert.Equal(t, http.StatusOK, res.Code)
	})

	t.Run("a token revoked after the descriptor was cached points at the token", func(t *testing.T) {
		e := newExtra()
		_, err := buildErr(e, url, token) // caches the descriptor
		require.NoError(t, err)
		repo, err := buildErr(e, url, "revoked")
		require.NoError(t, err)

		res, err := repo.Test(context.Background())
		require.NoError(t, err)
		assert.False(t, res.Success)
		assert.Equal(t, http.StatusUnauthorized, res.Code)
		require.Len(t, res.Errors, 1)
		assert.Equal(t, "secure.token", res.Errors[0].Field)
	})
}
