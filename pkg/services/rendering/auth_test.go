package rendering

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const renderAuthTestSecret = "shared-renderer-secret"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func newRenderAuthTestConfig(t *testing.T, stackID string) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.StackID = stackID
	cfg.AppURL = "http://grafana.example/"
	cfg.RendererServerUrl = "http://renderer.example/render"
	cfg.RendererAuthToken = renderAuthTestSecret
	cfg.RendererRenderKeyLifeTime = time.Hour
	cfg.ImagesDir = t.TempDir()
	cfg.CSVsDir = cfg.ImagesDir
	cfg.PDFsDir = cfg.ImagesDir
	return cfg
}

func newRenderAuthTestService(t *testing.T, stackID string, cache *remotecache.RemoteCache) *RenderingService {
	t.Helper()
	rs, err := ProvideService(newRenderAuthTestConfig(t, stackID), featuremgmt.WithFeatures(), cache, &dummyPluginManager{})
	require.NoError(t, err)
	require.IsType(t, &perRequestRenderKeyProvider{}, rs.perRequestRenderKeyProvider)
	return rs
}

func TestRenderKeyNamespace(t *testing.T) {
	tests := []struct {
		name, sourceStack, targetStack string
		renderOrg, requestOrg          int64
		wantNamespace                  string
		legacy, renderService          bool
	}{
		{name: "same stack", sourceStack: "100", targetStack: "100", requestOrg: 123, wantNamespace: "stacks-100"},
		{name: "different stack", sourceStack: "100", targetStack: "200", requestOrg: 123},
		{name: "different stack without org", sourceStack: "100", targetStack: "200"},
		{name: "same stack without org", sourceStack: "100", targetStack: "100", wantNamespace: "stacks-100"},
		{name: "stack boundary permits different org", sourceStack: "100", targetStack: "100", requestOrg: 124, wantNamespace: "stacks-100"},
		{name: "same on-prem org", requestOrg: 123, wantNamespace: "org-123"},
		{name: "different on-prem org", requestOrg: 124},
		{name: "on-prem without org", wantNamespace: "org-123"},
		{name: "default on-prem org without org", renderOrg: 1, wantNamespace: "default"},
		{name: "cloud key on-prem", sourceStack: "100", requestOrg: 123},
		{name: "on-prem key in cloud", targetStack: "100", requestOrg: 123},
		{name: "legacy cloud key", sourceStack: "100", targetStack: "100", requestOrg: 123, legacy: true},
		{name: "legacy cloud key without org", sourceStack: "100", targetStack: "100", legacy: true},
		{name: "legacy on-prem key without org", legacy: true},
		{name: "provisioned renderer on same stack", sourceStack: "100", targetStack: "100", renderService: true, wantNamespace: "stacks-100"},
		{name: "provisioned renderer on different stack", sourceStack: "100", targetStack: "200", renderService: true},
	}
	cache := remotecache.NewFakeStore(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			source := newRenderAuthTestService(t, tt.sourceStack, cache)
			target := newRenderAuthTestService(t, tt.targetStack, cache)
			orgID := tt.renderOrg
			if orgID == 0 {
				orgID = 123
			}
			opts := AuthOpts{OrgID: orgID, UserID: 22, OrgRole: org.RoleViewer}
			if tt.renderService {
				opts.UserID = 0
				opts.OrgRole = org.RoleAdmin
			}
			key, err := source.perRequestRenderKeyProvider.get(t.Context(), opts)
			require.NoError(t, err)
			if tt.legacy {
				var buf bytes.Buffer
				require.NoError(t, gob.NewEncoder(&buf).Encode(&RenderUser{OrgID: orgID, UserID: opts.UserID, OrgRole: string(opts.OrgRole)}))
				require.NoError(t, cache.Set(t.Context(), fmt.Sprintf(renderKeyPrefix, key), buf.Bytes(), time.Hour))
			}
			user, found := target.GetRenderUser(t.Context(), key, tt.requestOrg)
			require.Equal(t, tt.wantNamespace != "", found)
			if !found {
				require.Nil(t, user)
				return
			}
			require.Equal(t, &RenderUser{OrgID: orgID, UserID: opts.UserID, OrgRole: string(opts.OrgRole), Namespace: tt.wantNamespace}, user)
		})
	}
}

func TestRenderAuthJWTUnsupported(t *testing.T) {
	for _, rendererURL := range []string{"", "http://renderer.example/render"} {
		t.Run(rendererURL, func(t *testing.T) {
			cfg := newRenderAuthTestConfig(t, "100")
			cfg.RendererServerUrl = rendererURL
			rs, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagRenderAuthJWT), nil, &dummyPluginManager{})
			require.ErrorContains(t, err, "renderAuthJWT is not supported")
			require.Nil(t, rs)
		})
	}
}

func TestRenderJWTRejected(t *testing.T) {
	cache := remotecache.NewFakeStore(t)
	rs := newRenderAuthTestService(t, "", cache)
	for _, userID := range []int64{-1, 0, 22} {
		for _, namespace := range []string{"", "org-123"} {
			t.Run(fmt.Sprintf("user=%d/namespace=%s", userID, namespace), func(t *testing.T) {
				claims := struct {
					RenderUser *RenderUser
					jwt.RegisteredClaims
				}{
					RenderUser:       &RenderUser{OrgID: 123, UserID: userID, OrgRole: "Admin", Namespace: namespace},
					RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
				}
				key, err := jwt.NewWithClaims(jwt.SigningMethodHS512, claims).SignedString([]byte(renderAuthTestSecret))
				require.NoError(t, err)
				user, found := rs.GetRenderUser(t.Context(), key, 0)
				require.False(t, found)
				require.Nil(t, user)
			})
		}
	}
}

func TestRenderAuthUnavailable(t *testing.T) {
	cache := remotecache.NewFakeStore(t)
	rs := newRenderAuthTestService(t, "100", cache)
	user := &RenderUser{OrgID: 123, UserID: 22, OrgRole: "Viewer", Namespace: "stacks-100"}
	key := "opaque-render-key"
	var buf bytes.Buffer
	require.NoError(t, gob.NewEncoder(&buf).Encode(user))
	require.NoError(t, cache.Set(t.Context(), fmt.Sprintf(renderKeyPrefix, key), buf.Bytes(), time.Hour))
	rs.Cfg.RendererServerUrl = ""
	got, found := rs.GetRenderUser(t.Context(), key, 0)
	require.False(t, found)
	require.Nil(t, got)

	rs.pluginAvailable = true
	got, found = rs.GetRenderUser(t.Context(), key, 0)
	require.True(t, found)
	require.Equal(t, user, got)
}

func TestRenderKeyNilConfigNamespace(t *testing.T) {
	cache := remotecache.NewFakeStore(t)
	rs := newRenderAuthTestService(t, "", cache)
	provider := &perRequestRenderKeyProvider{cache: cache, keyExpiry: time.Hour, namespacer: request.GetNamespaceMapper(nil)}
	key, err := provider.get(t.Context(), AuthOpts{OrgID: 1, UserID: 22, OrgRole: org.RoleViewer})
	require.NoError(t, err)
	user, found := rs.GetRenderUser(t.Context(), key, 0)
	require.True(t, found)
	require.Equal(t, "default", user.Namespace)
	_, found = rs.GetRenderUser(t.Context(), key, 2)
	require.False(t, found)
}
