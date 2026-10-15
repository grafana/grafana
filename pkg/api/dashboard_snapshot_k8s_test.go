package api

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	unifiedmigrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
	"github.com/grafana/grafana/pkg/web"
)

type snapshotAPIRoundTripper func(*http.Request) (*http.Response, error)

func (f snapshotAPIRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func snapshotAPIResponse(r *http.Request, status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(bytes.NewBufferString(body)), Request: r}
}

func snapshotAPIContext(t *testing.T, path string) (*HTTPServer, *contextmodel.ReqContext) {
	t.Helper()
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagSnapshotsKubernetesSnapshots)
	cfg := setting.NewCfg()
	cfg.SnapshotEnabled = true
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = web.SetURLParams(req, map[string]string{":key": "snapshot-key", ":deleteKey": "delete-key"})
	ctx := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder())}, SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1}, IsSignedIn: true, Logger: log.New("snapshot-api-test")}
	return &HTTPServer{Cfg: cfg, Features: featuremgmt.WithFeatures()}, ctx
}

type snapshotMigrationStatusReader struct {
	unifiedmigrations.MigrationStatusReader
	mode unifiedmigrations.StorageMode
	err  error
}

func (r snapshotMigrationStatusReader) GetStorageMode(_ context.Context, gr schema.GroupResource) (unifiedmigrations.StorageMode, error) {
	if gr.Group != "dashboard.grafana.app" || gr.Resource != "snapshots" {
		return 0, fmt.Errorf("unexpected resource: %s", gr)
	}
	return r.mode, r.err
}

func TestSelfManagedPublicSnapshotReadStore(t *testing.T) {
	for _, mode := range []grafanarest.DualWriterMode{0, 1, 2, 3, 4, 5} {
		for _, resolved := range []unifiedmigrations.StorageMode{unifiedmigrations.StorageModeLegacy, unifiedmigrations.StorageModeDualWrite, unifiedmigrations.StorageModeUnified} {
			t.Run(fmt.Sprintf("mode=%d/resolved=%s", mode, resolved), func(t *testing.T) {
				hs, c := snapshotAPIContext(t, "/api/snapshots/snapshot-key")
				c.IsSignedIn = false
				c.SignedInUser = &user.SignedInUser{IsAnonymous: true}
				hs.Cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
					setting.SnapshotResource: {DualWriterMode: mode},
				}
				hs.migrationStatusReader = snapshotMigrationStatusReader{mode: resolved}
				hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
					t.Fatal("Self-managed public reads must not reach Kubernetes storage")
					return nil, nil
				})}
				service := dashboardsnapshots.NewMockService(t)
				hs.dashboardsnapshotsService = service
				status := http.StatusServiceUnavailable
				if resolved == unifiedmigrations.StorageModeLegacy {
					status = http.StatusOK
					service.On("GetDashboardSnapshot", c.Req.Context(), &dashboardsnapshots.GetDashboardSnapshotQuery{Key: "snapshot-key"}).
						Return(&dashboardsnapshots.DashboardSnapshot{Dashboard: simplejson.New(), Expires: time.Now().Add(time.Hour)}, nil).Once()
				}
				require.Equal(t, status, hs.GetDashboardSnapshot(c).Status())
			})
		}
	}
}

func TestSelfManagedPublicSnapshotReadStorageError(t *testing.T) {
	hs, c := snapshotAPIContext(t, "/api/snapshots/snapshot-key")
	hs.migrationStatusReader = snapshotMigrationStatusReader{err: errors.New("migration log unavailable")}
	hs.dashboardsnapshotsService = dashboardsnapshots.NewMockService(t)
	require.Equal(t, http.StatusServiceUnavailable, hs.GetDashboardSnapshot(c).Status())
}

func TestGetDashboardSnapshotFromAPI(t *testing.T) {
	for _, tc := range []struct {
		name                string
		orgID               int64
		anonymous, noExpiry bool
		status              int
	}{
		{name: "authenticated", status: 200},
		{name: "anonymous", anonymous: true, status: 200},
		{name: "viewer in another org", orgID: 2, status: 200},
		{name: "anonymous in another org", orgID: 2, anonymous: true, status: 200},
		{name: "never expires", noExpiry: true, status: 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hs, c := snapshotAPIContext(t, "/api/snapshots/snapshot-key")
			if tc.anonymous {
				c.IsSignedIn = false
				c.SignedInUser = &user.SignedInUser{IsAnonymous: true}
			}
			if tc.orgID != 0 {
				c.OrgID = tc.orgID
			}
			hs.Cfg.StackID = "123"
			namespace := "stacks-123"
			expires := time.Now().Add(time.Hour).UnixMilli()
			if tc.noExpiry {
				expires = 0
			}
			calls := 0
			hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				requester, err := identity.GetRequester(r.Context())
				require.NoError(t, err)
				expectedOrgID := c.GetOrgID()
				if expectedOrgID < 1 {
					expectedOrgID = 1
				}
				require.Equal(t, expectedOrgID, requester.GetOrgID())
				require.Equal(t, c.GetIdentityType(), requester.GetIdentityType())
				switch r.URL.Path {
				case "/apis/dashboard.grafana.app/v0alpha1/namespaces/" + namespace + "/snapshots/snapshot-key":
					return snapshotAPIResponse(r, 200, fmt.Sprintf(`{"metadata":{"name":"snapshot-key","creationTimestamp":"2026-10-01T10:00:00Z"},"spec":{"expires":%d}}`, expires)), nil
				case "/apis/dashboard.grafana.app/v0alpha1/namespaces/" + namespace + "/snapshots/snapshot-key/dashboard":
					return snapshotAPIResponse(r, 200, `{"spec":{"title":"smoke","panels":[]}}`), nil
				default:
					t.Fatalf("unexpected request %s", r.URL)
					return nil, nil
				}
			})}
			result := hs.GetDashboardSnapshot(c)
			require.Equal(t, tc.status, result.Status(), string(result.Body()))
			require.Equal(t, 2, calls)
			var value struct {
				Dashboard map[string]any `json:"dashboard"`
				Meta      struct {
					IsSnapshot bool      `json:"isSnapshot"`
					Expires    time.Time `json:"expires"`
				} `json:"meta"`
			}
			require.NoError(t, json.Unmarshal(result.Body(), &value))
			require.Equal(t, "smoke", value.Dashboard["title"])
			require.True(t, value.Meta.IsSnapshot)
			require.True(t, value.Meta.Expires.After(time.Now()))
		})
	}
}

func TestSnapshotAPIErrorPropagation(t *testing.T) {
	for _, status := range []int{403, 404, 500} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			hs, c := snapshotAPIContext(t, "/api/snapshots/snapshot-key")
			hs.Cfg.StackID = "123"
			hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
				return snapshotAPIResponse(r, status, fmt.Sprintf(`{"kind":"Status","apiVersion":"v1","status":"Failure","message":"storage failure","code":%d}`, status)), nil
			})}
			result := hs.GetDashboardSnapshot(c)
			require.Equal(t, status, result.Status())
		})
	}
}

func TestDeleteSnapshotFromAPI(t *testing.T) {
	for _, byKey := range []bool{false, true} {
		t.Run(fmt.Sprint(byKey), func(t *testing.T) {
			hs, c := snapshotAPIContext(t, "/api/snapshots/snapshot-key")
			if !byKey {
				service := dashboardsnapshots.NewMockService(t)
				service.On("GetDashboardSnapshot", mock.Anything, &dashboardsnapshots.GetDashboardSnapshotQuery{Key: "snapshot-key"}).
					Return(&dashboardsnapshots.DashboardSnapshot{ID: 42}, nil)
				hs.dashboardsnapshotsService = service
			}
			calls := 0
			hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, http.MethodDelete, r.Method)
				path := "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/snapshot-key"
				if byKey {
					path = "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/delete/delete-key"
				}
				require.Equal(t, path, r.URL.Path)
				return snapshotAPIResponse(r, 200, `{"kind":"Status","apiVersion":"v1","status":"Success","code":200}`), nil
			})}
			var result response.Response
			if byKey {
				result = hs.DeleteDashboardSnapshotByDeleteKey(c)
			} else {
				result = hs.DeleteDashboardSnapshot(c)
			}
			require.Equal(t, 200, result.Status(), string(result.Body()))
			require.Equal(t, 1, calls)
			require.Contains(t, string(result.Body()), "Snapshot deleted")
			if !byKey {
				var body struct {
					ID int64 `json:"id"`
				}
				require.NoError(t, json.Unmarshal(result.Body(), &body))
				require.Equal(t, int64(42), body.ID)
			}
		})
	}
}

func TestSearchSnapshotsFromAPIFiltersBeforeLegacyLimit(t *testing.T) {
	hs, c := snapshotAPIContext(t, "/api/dashboard/snapshots?query=matching%25&limit=1")
	items := []map[string]any{
		{"metadata": map[string]any{"name": "unrelated-1"}, "spec": map[string]any{"title": "other"}},
		{"metadata": map[string]any{"name": "unrelated-2"}, "spec": map[string]any{"title": "other"}},
		{"metadata": map[string]any{"name": "matching-key"}, "spec": map[string]any{"title": "matching dashboard"}},
	}
	hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		require.NoError(t, err)
		require.Greater(t, limit, 0)
		limit = min(limit, len(items))
		body, err := json.Marshal(map[string]any{"items": items[:limit]})
		require.NoError(t, err)
		return snapshotAPIResponse(r, 200, string(body)), nil
	})}
	result := hs.SearchDashboardSnapshots(c)
	require.Equal(t, http.StatusOK, result.Status(), string(result.Body()))
	var list []dashboardsnapshots.DashboardSnapshotDTO
	require.NoError(t, json.Unmarshal(result.Body(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "matching-key", list[0].Key)
}

func TestSearchSnapshotsFromAPIRetriesUnifiedOnlyContinuation(t *testing.T) {
	hs, c := snapshotAPIContext(t, "/api/dashboard/snapshots?query=matching%25&limit=1")
	unifiedOnlyToken := base64.StdEncoding.EncodeToString([]byte(",unified-page-2"))
	items := []map[string]any{
		{"metadata": map[string]any{"name": "unrelated"}, "spec": map[string]any{"title": "other"}},
		{"metadata": map[string]any{"name": "matching-key"}, "spec": map[string]any{"title": "matching dashboard"}},
	}
	var limits []string
	hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
		limitText := r.URL.Query().Get("limit")
		limits = append(limits, limitText)
		if r.URL.Query().Get("continue") == unifiedOnlyToken {
			return snapshotAPIResponse(r, 200, `{"items":[]}`), nil
		}
		require.Empty(t, r.URL.Query().Get("continue"))
		limit, err := strconv.Atoi(limitText)
		require.NoError(t, err)
		body, err := json.Marshal(map[string]any{"metadata": map[string]any{"continue": unifiedOnlyToken}, "items": items[:min(limit, len(items))]})
		require.NoError(t, err)
		return snapshotAPIResponse(r, 200, string(body)), nil
	})}
	result := hs.SearchDashboardSnapshots(c)
	require.Equal(t, http.StatusOK, result.Status(), string(result.Body()))
	var list []dashboardsnapshots.DashboardSnapshotDTO
	require.NoError(t, json.Unmarshal(result.Body(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "matching-key", list[0].Key)
	require.Equal(t, []string{"1", "1", "2"}, limits)
}

func TestSearchSnapshotsFromAPIPaginatesFilteredResults(t *testing.T) {
	hs, c := snapshotAPIContext(t, "/api/dashboard/snapshots?query=smoke%25&limit=1")
	calls := 0
	hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
		calls++
		require.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots", r.URL.Path)
		require.Equal(t, "1", r.URL.Query().Get("limit"))
		if calls == 1 {
			require.Empty(t, r.URL.Query().Get("continue"))
			return snapshotAPIResponse(r, 200, `{"metadata":{"continue":"page2"},"items":[{"metadata":{"name":"unrelated"},"spec":{"title":"other"}}]}`), nil
		}
		require.Equal(t, "page2", r.URL.Query().Get("continue"))
		return snapshotAPIResponse(r, 200, `{"items":[{"metadata":{"name":"snapshot-key","creationTimestamp":"2026-10-01T10:00:00Z"},"spec":{"title":"smoke dashboard","external":true,"externalUrl":"https://example.com/snapshot"}}]}`), nil
	})}
	result := hs.SearchDashboardSnapshots(c)
	require.Equal(t, 200, result.Status(), string(result.Body()))
	require.Equal(t, 2, calls)
	var list []dashboardsnapshots.DashboardSnapshotDTO
	require.NoError(t, json.Unmarshal(result.Body(), &list))
	require.Len(t, list, 1)
	require.Equal(t, "snapshot-key", list[0].Key)
	require.Equal(t, "smoke dashboard", list[0].Name)
	require.True(t, list[0].External)
	require.Equal(t, "https://example.com/snapshot", list[0].ExternalURL)
	require.NotContains(t, string(result.Body()), "deleteKey")
}

func TestSnapshotMigrationLegacyFallbacks(t *testing.T) {
	for _, endpoint := range []string{"get", "list", "delete", "delete key", "public legacy delete key"} {
		t.Run(endpoint, func(t *testing.T) {
			hs, c := snapshotAPIContext(t, "/api/dashboard/snapshots?limit=5")
			if endpoint == "public legacy delete key" {
				hs.Cfg.SnapshotPublicMode = true
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagExternalSnapshotsSupportLegacyAPI)
				c.IsSignedIn = false
			} else {
				featuremgmt.WithDisabledFlags(t, featuremgmt.FlagSnapshotsKubernetesSnapshots)
			}
			service := dashboardsnapshots.NewMockService(t)
			hs.dashboardsnapshotsService = service
			if endpoint == "list" {
				service.On("SearchDashboardSnapshots", c.Req.Context(), mock.Anything).Return(dashboardsnapshots.DashboardSnapshotsList{{Key: "snapshot-key", Name: "legacy"}}, nil)
			} else {
				query := &dashboardsnapshots.GetDashboardSnapshotQuery{Key: "snapshot-key"}
				if endpoint == "delete key" || endpoint == "public legacy delete key" {
					query = &dashboardsnapshots.GetDashboardSnapshotQuery{DeleteKey: "delete-key"}
				}
				service.On("GetDashboardSnapshot", c.Req.Context(), query).Return(&dashboardsnapshots.DashboardSnapshot{Key: "snapshot-key", DeleteKey: "delete-key", OrgID: 1, Dashboard: simplejson.NewFromAny(map[string]any{"title": "legacy"}), Expires: time.Now().Add(time.Hour)}, nil)
				if endpoint != "get" {
					service.On("DeleteDashboardSnapshot", c.Req.Context(), &dashboardsnapshots.DeleteDashboardSnapshotCommand{DeleteKey: "delete-key"}).Return(nil)
				}
			}
			var result response.Response
			switch endpoint {
			case "get":
				result = hs.GetDashboardSnapshot(c)
			case "list":
				result = hs.SearchDashboardSnapshots(c)
			case "delete":
				result = hs.DeleteDashboardSnapshot(c)
			default:
				result = hs.DeleteDashboardSnapshotByDeleteKey(c)
			}
			require.Equal(t, http.StatusOK, result.Status(), string(result.Body()))
		})
	}
}

func TestSnapshotAPINamespaceMapping(t *testing.T) {
	for _, tc := range []struct {
		name, stack, namespace string
		orgID                  int64
	}{
		{name: "another org", namespace: "org-2", orgID: 2},
		{name: "cloud stack", stack: "123", namespace: "stacks-123", orgID: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hs, c := snapshotAPIContext(t, "/api/dashboard/snapshots")
			hs.Cfg.StackID = tc.stack
			c.OrgID = tc.orgID
			hs.clientConfigProvider = &mockDirectRestConfigProvider{host: "http://localhost", transport: snapshotAPIRoundTripper(func(r *http.Request) (*http.Response, error) {
				require.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/"+tc.namespace+"/snapshots", r.URL.Path)
				return snapshotAPIResponse(r, 200, `{"items":[]}`), nil
			})}
			result := hs.SearchDashboardSnapshots(c)
			require.Equal(t, http.StatusOK, result.Status(), string(result.Body()))
			require.JSONEq(t, `[]`, string(result.Body()))
		})
	}
}

func TestSnapshotSharingOptionsRemainConfigOnly(t *testing.T) {
	hs, c := snapshotAPIContext(t, "/api/snapshot/shared-options")
	hs.Cfg.ExternalEnabled = true
	hs.Cfg.ExternalSnapshotName = "External"
	hs.Cfg.ExternalSnapshotUrl = "https://example.com"
	hs.GetSharingOptions(c)
	require.Equal(t, http.StatusOK, c.Resp.Status())
}
