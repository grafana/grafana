package orgimpl

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

func TestResourceDeleter_deletesOnlyTargetNamespaceInDependencyOrder(t *testing.T) {
	var paths []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodDelete, r.Method)
		assert.Empty(t, r.URL.RawQuery)
		paths = append(paths, r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, err := fmt.Fprint(w, `{"apiVersion":"v1","kind":"Status","status":"Success"}`)
		assert.NoError(t, err)
	}))
	t.Cleanup(server.Close)
	clientConfig := &rest.Config{Host: server.URL}
	deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		return clientConfig, nil
	}), log.NewNopLogger())

	require.NoError(t, deleter.deleteCollections(context.Background(), 42))
	require.Equal(t, []string{
		"/apis/playlist.grafana.app/v1/namespaces/org-42/playlists",
		"/apis/rules.alerting.grafana.app/v0alpha1/namespaces/org-42/rulesequences",
		"/apis/rules.alerting.grafana.app/v0alpha1/namespaces/org-42/alertrules",
		"/apis/rules.alerting.grafana.app/v0alpha1/namespaces/org-42/recordingrules",
		"/apis/rules.alerting.grafana.app/v0alpha1/namespaces/org-42/configs",
	}, paths)
}

func TestResourceDeleter_cloudNeverDeletesStackResources(t *testing.T) {
	for _, tc := range []struct {
		name    string
		stackID string
		orgID   int64
	}{
		{name: "primary org", stackID: "123", orgID: 1},
		{name: "secondary org", stackID: "123", orgID: 2},
		{name: "invalid stack ID", stackID: "invalid", orgID: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stackID
			deleter := newK8sResourceDeleter(cfg, apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
				t.Fatal("Cloud org cleanup must not initialize an API client")
				return nil, nil
			}), log.NewNopLogger())
			require.NoError(t, deleter.deleteCollections(context.Background(), tc.orgID))
		})
	}
}

func TestResourceDeleter_rejectsInvalidOrgBeforeCallingAPI(t *testing.T) {
	deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.WithoutRestConfig, log.NewNopLogger())
	for _, orgID := range []int64{0, -1} {
		require.ErrorContains(t, deleter.deleteCollections(context.Background(), orgID), "invalid org ID")
	}
}

func TestResourceDeleter_restConfigFailure(t *testing.T) {
	wantErr := errors.New("API server unavailable")
	deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		return nil, wantErr
	}), log.NewNopLogger())
	err := deleter.deleteCollections(context.Background(), 2)
	require.ErrorIs(t, err, wantErr)
	require.ErrorContains(t, err, "get rest config")
}

func TestResourceDeleter_cancelledContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("cancelled cleanup must not send a request")
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(server.Close)
	deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		return &rest.Config{Host: server.URL}, nil
	}), log.NewNopLogger())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	require.ErrorIs(t, deleter.deleteCollections(ctx, 2), context.Canceled)
}

func TestResourceDeleter_invalidRestConfig(t *testing.T) {
	deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
		return &rest.Config{Host: "://invalid"}, nil
	}), log.NewNopLogger())
	require.ErrorContains(t, deleter.deleteCollections(context.Background(), 2), "create dynamic client")
}

func TestResourceDeleter_collectionFailure(t *testing.T) {
	for _, tc := range []struct {
		name      string
		code      int
		reason    string
		wantCalls int
	}{
		{name: "unregistered sequence API is skipped", code: 404, reason: "NotFound", wantCalls: 5},
		{name: "unsupported sequence deletion is skipped", code: 405, reason: "MethodNotAllowed", wantCalls: 5},
		{name: "forbidden stops before deleting rules", code: 403, reason: "Forbidden", wantCalls: 2},
		{name: "server error stops before deleting rules", code: 500, reason: "InternalError", wantCalls: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				w.Header().Set("Content-Type", "application/json")
				if calls == 2 {
					w.WriteHeader(tc.code)
					_, err := fmt.Fprintf(w, `{"apiVersion":"v1","kind":"Status","status":"Failure","reason":%q,"code":%d}`, tc.reason, tc.code)
					assert.NoError(t, err)
					return
				}
				_, err := fmt.Fprint(w, `{"apiVersion":"v1","kind":"Status","status":"Success"}`)
				assert.NoError(t, err)
			}))
			t.Cleanup(server.Close)
			deleter := newK8sResourceDeleter(setting.NewCfg(), apiserver.RestConfigProviderFunc(func(context.Context) (*rest.Config, error) {
				return &rest.Config{Host: server.URL}, nil
			}), log.NewNopLogger())
			err := deleter.deleteCollections(context.Background(), 2)
			if tc.wantCalls == 5 {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, "delete collection rules.alerting.grafana.app/v0alpha1, Resource=rulesequences")
			}
			require.Equal(t, tc.wantCalls, calls)
		})
	}
}
