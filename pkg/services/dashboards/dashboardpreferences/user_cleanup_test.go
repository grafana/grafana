package dashboardpreferences

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type fakeResponse struct {
	code        int
	contentType string
	body        string
}

var statusSuccess = fakeResponse{http.StatusOK, "application/json", `{"kind":"Status","apiVersion":"v1","status":"Success"}`}

// Every test that uses newTestCleaner also checks that the rest config is asked for namespace, with a context that has a
// deadline and ignores the caller's cancellation, and that each request carries Grafana's service identity, limited to
// namespace.
func newTestCleaner(t *testing.T, namespace string, serve func(*http.Request) (fakeResponse, error)) (UserCleaner, *[]string) {
	t.Helper()
	var requests []string
	rt := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requests = append(requests, req.Method+" "+req.URL.Path)
		assert.True(t, identity.IsServiceIdentity(req.Context()), "the delete must be sent as Grafana's service identity")
		requester, err := identity.GetRequester(req.Context())
		if assert.NoError(t, err) {
			assert.Equal(t, namespace, requester.GetNamespace())
		}
		res, err := serve(req)
		if err != nil {
			return nil, err
		}
		return &http.Response{
			StatusCode: res.code,
			Header:     http.Header{"Content-Type": []string{res.contentType}},
			Body:       io.NopCloser(strings.NewReader(res.body)),
			Request:    req,
		}, nil
	})
	cleaner := NewUserCleaner(func(ctx context.Context, gotNamespace string) (*rest.Config, error) {
		assert.Equal(t, namespace, gotNamespace, "the rest config must be for the namespace the delete is in")
		assert.NoError(t, ctx.Err(), "the wait for the rest config must not end with the caller's context")
		_, bounded := ctx.Deadline()
		assert.True(t, bounded, "the wait for the rest config must be bounded")
		return &rest.Config{Host: "http://loopback", Transport: rt}, nil
	})
	return cleaner, &requests
}

func TestUserCleaner_DeleteUserPreferences(t *testing.T) {
	tests := []struct {
		name        string
		namespace   string
		userUID     string
		response    fakeResponse
		wantRequest []string
		wantErr     func(t *testing.T, err error)
	}{
		{
			name:        "deletes the user tier by name",
			namespace:   "org-2",
			userUID:     "u1",
			response:    statusSuccess,
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/org-2/dashboardpreferences/user-u1"},
		},
		{
			name:      "a missing tier is not an error",
			namespace: "default",
			userUID:   "u1",
			response: fakeResponse{http.StatusNotFound, "application/json",
				`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"NotFound","code":404,` +
					`"details":{"group":"dashboard.grafana.app","kind":"dashboardpreferences","name":"user-u1"}}`},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboardpreferences/user-u1"},
		},
		{
			name:      "a 404 for another object is an error",
			namespace: "default",
			userUID:   "u1",
			response: fakeResponse{http.StatusNotFound, "application/json",
				`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"NotFound","code":404,` +
					`"details":{"group":"dashboard.grafana.app","kind":"dashboardpreferences","name":"user-u2"}}`},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboardpreferences/user-u1"},
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.ErrorContains(t, err, "delete user-u1 in namespace default")
			},
		},
		{
			name:        "a route that isn't served is an error",
			namespace:   "default",
			userUID:     "u1",
			response:    fakeResponse{http.StatusNotFound, "text/plain", "404 page not found"},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboardpreferences/user-u1"},
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, ErrNotServed)
				require.ErrorContains(t, err, "delete user-u1 in namespace default")
			},
		},
		{
			name:      "a refused delete is an error",
			namespace: "default",
			userUID:   "u1",
			response: fakeResponse{http.StatusForbidden, "application/json",
				`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"Forbidden","code":403,"message":"access denied"}`},
			wantRequest: []string{"DELETE /apis/dashboard.grafana.app/v2beta1/namespaces/default/dashboardpreferences/user-u1"},
			wantErr: func(t *testing.T, err error) {
				require.True(t, apierrors.IsForbidden(err), "want a Forbidden error, got %v", err)
				require.ErrorContains(t, err, "delete user-u1 in namespace default")
			},
		},
		{
			name:      "an unknown namespace sends nothing",
			namespace: "users",
			userUID:   "u1",
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, errNamespaceUnknown)
				require.ErrorContains(t, err, `invalid namespace "users"`)
			},
		},
		{
			name:      "a namespace that doesn't parse sends nothing",
			namespace: "org-0",
			userUID:   "u1",
			wantErr: func(t *testing.T, err error) {
				require.ErrorContains(t, err, `invalid namespace "org-0"`)
			},
		},
		{
			name:      "an empty namespace sends nothing",
			namespace: "",
			userUID:   "u1",
			wantErr: func(t *testing.T, err error) {
				require.ErrorIs(t, err, errNamespaceUnknown)
			},
		},
		{
			name:      "an empty user UID sends nothing",
			namespace: "default",
			userUID:   "",
		},
		{
			name:      "a name storage would refuse sends nothing",
			namespace: "default",
			userUID:   "has space",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleaner, requests := newTestCleaner(t, tc.namespace, func(*http.Request) (fakeResponse, error) {
				return tc.response, nil
			})

			err := cleaner.DeleteUserPreferences(t.Context(), tc.namespace, tc.userUID)

			if tc.wantErr == nil {
				require.NoError(t, err)
			} else {
				tc.wantErr(t, err)
			}
			require.Equal(t, tc.wantRequest, *requests)
		})
	}
}

func TestUserCleaner_RestConfigError(t *testing.T) {
	cleaner := NewUserCleaner(func(context.Context, string) (*rest.Config, error) {
		return nil, errors.New("API server unavailable")
	})

	err := cleaner.DeleteUserPreferences(t.Context(), "default", "u1")

	require.ErrorContains(t, err, "API server unavailable")
}

func TestUserCleaner_OutlivesCallerCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	cleaner, requests := newTestCleaner(t, "default", func(req *http.Request) (fakeResponse, error) {
		assert.NoError(t, req.Context().Err())
		return statusSuccess, nil
	})

	err := cleaner.DeleteUserPreferences(ctx, "default", "u1")

	require.NoError(t, err)
	require.Len(t, *requests, 1)
}

func TestUserCleaner_BoundsTheDelete(t *testing.T) {
	t.Run("an API server that doesn't answer", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			cleaner, _ := newTestCleaner(t, "default", func(req *http.Request) (fakeResponse, error) {
				<-req.Context().Done()
				return fakeResponse{}, req.Context().Err()
			})
			start := time.Now()

			err := cleaner.DeleteUserPreferences(t.Context(), "default", "u1")

			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.Equal(t, userCleanupTimeout, time.Since(start))
		})
	})

	t.Run("an API server that isn't ready yet", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			// Until the API server starts, the eventual rest config returns only when its context is done.
			cleaner := ProvideUserCleaner(apiserver.ProvideEventualRestConfigProvider())
			start := time.Now()

			err := cleaner.DeleteUserPreferences(t.Context(), "default", "u1")

			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.Equal(t, userCleanupTimeout, time.Since(start))
		})
	})
}

type recordingCleaner struct {
	failOn string
	calls  []string
}

func (c *recordingCleaner) DeleteUserPreferences(_ context.Context, namespace, userUID string) error {
	c.calls = append(c.calls, namespace+"/"+userUID)
	if namespace == c.failOn {
		return errors.New("delete refused")
	}
	return nil
}

func TestUserLeftOrgs(t *testing.T) {
	tests := []struct {
		name          string
		stackID       string
		userUID       string
		left          []int64
		remaining     []int64
		failOn        string
		inTransaction bool
		want          []string
	}{
		{
			name:      "removed from one org",
			userUID:   "u1",
			left:      []int64{2},
			remaining: []int64{1},
			want:      []string{"org-2/u1"},
		},
		{
			name:    "deleted from every org",
			userUID: "u1",
			left:    []int64{1, 2},
			want:    []string{"default/u1", "org-2/u1"},
		},
		{
			name:    "a failure doesn't stop the other orgs",
			userUID: "u1",
			left:    []int64{1, 2},
			failOn:  "default",
			want:    []string{"default/u1", "org-2/u1"},
		},
		{
			name:      "Cloud: still in another org of the stack",
			stackID:   "123",
			userUID:   "u1",
			left:      []int64{2},
			remaining: []int64{1},
		},
		{
			name:    "Cloud: left the stack's last org",
			stackID: "123",
			userUID: "u1",
			left:    []int64{1},
			want:    []string{"stacks-123/u1"},
		},
		{
			name:    "Cloud: deleted from two orgs of a stack",
			stackID: "123",
			userUID: "u1",
			left:    []int64{1, 2},
			want:    []string{"stacks-123/u1"},
		},
		{
			name:    "no user UID",
			userUID: "",
			left:    []int64{1},
		},
		{
			name:          "inside an open SQL transaction",
			userUID:       "u1",
			left:          []int64{2},
			remaining:     []int64{1},
			inTransaction: true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stackID
			ctx := t.Context()
			if tc.inTransaction {
				ctx = context.WithValue(ctx, sqlstore.ContextSessionKey{}, &sqlstore.DBSession{})
			}
			cleaner := &recordingCleaner{failOn: tc.failOn}

			UserLeftOrgs(ctx, cleaner, cfg, tc.userUID, tc.left, tc.remaining)

			require.Equal(t, tc.want, cleaner.calls)
		})
	}

	t.Run("a nil cleaner does nothing", func(t *testing.T) {
		require.NotPanics(t, func() {
			UserLeftOrgs(t.Context(), nil, setting.NewCfg(), "u1", []int64{1, 2}, nil)
		})
	})
}

func TestUserLeftNamespace(t *testing.T) {
	t.Run("deletes the tier", func(t *testing.T) {
		cleaner := &recordingCleaner{}

		UserLeftNamespace(t.Context(), cleaner, "org-2", "u1")

		require.Equal(t, []string{"org-2/u1"}, cleaner.calls)
	})

	t.Run("a failure is not returned and doesn't panic", func(t *testing.T) {
		cleaner := &recordingCleaner{failOn: "org-2"}

		require.NotPanics(t, func() {
			UserLeftNamespace(t.Context(), cleaner, "org-2", "u1")
		})
		require.Equal(t, []string{"org-2/u1"}, cleaner.calls)
	})

	t.Run("an empty namespace sends nothing", func(t *testing.T) {
		cleaner := &recordingCleaner{}

		UserLeftNamespace(t.Context(), cleaner, "", "u1")

		require.Empty(t, cleaner.calls)
	})

	t.Run("an empty user UID sends nothing", func(t *testing.T) {
		cleaner := &recordingCleaner{}

		UserLeftNamespace(t.Context(), cleaner, "org-2", "")

		require.Empty(t, cleaner.calls)
	})

	t.Run("a nil cleaner does nothing", func(t *testing.T) {
		require.NotPanics(t, func() {
			UserLeftNamespace(t.Context(), nil, "org-2", "u1")
		})
	})
}
