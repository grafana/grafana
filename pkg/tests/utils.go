package tests

import (
	"context"
	"crypto/tls"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/go-openapi/strfmt"
	goapi "github.com/grafana/grafana-openapi-client-go/client"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func SkipIntegrationTestInShortMode(t testing.TB) {
	t.Helper()
	if !strings.HasPrefix(t.Name(), "TestIntegration") {
		t.Fatal("test is not an integration test")
	}
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
}

func CreateUser(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1

	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), db, cfgProvider)
	orgService, err := orgimpl.ProvideService(db, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		db, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	u, err := usrSvc.Create(context.Background(), &cmd)
	require.NoError(t, err)
	return u.ID
}

func GetClient(host string, username string, password string) *goapi.GrafanaHTTPAPI {
	cfg := &goapi.TransportConfig{
		// Host is the doman name or IP address of the host that serves the API.
		Host: host,
		// BasePath is the URL prefix for all API paths, relative to the host root.
		BasePath: "/api",
		// Schemes are the transfer protocols used by the API (http or https).
		Schemes: []string{"http"},
		// APIKey is an optional API key or service account token.
		APIKey: os.Getenv("API_ACCESS_TOKEN"),
		// BasicAuth is optional basic auth credentials.
		BasicAuth: url.UserPassword(username, password),
		// OrgID provides an optional organization ID.
		// OrgID is only supported with BasicAuth since API keys are already org-scoped.
		OrgID: 1,
		// TLSConfig provides an optional configuration for a TLS client
		TLSConfig: &tls.Config{},
		// NumRetries contains the optional number of attempted retries
		NumRetries: 3,
		// RetryTimeout sets an optional time to wait before retrying a request
		RetryTimeout: 0,
		// RetryStatusCodes contains the optional list of status codes to retry
		// Use "x" as a wildcard for a single digit (default: [429, 5xx])
		RetryStatusCodes: []string{"420", "5xx"},
		// HTTPHeaders contains an optional map of HTTP headers to add to each request
		HTTPHeaders: map[string]string{},
	}
	return goapi.NewHTTPClientWithConfig(strfmt.Default, cfg)
}

func RemoveFolderPermission(t *testing.T, store resourcepermissions.Store, orgID int64, role org.RoleType, uid string) {
	t.Helper()

	// remove org role permissions from folder
	_, _ = store.SetBuiltInResourcePermission(context.Background(), orgID, string(role), resourcepermissions.SetResourcePermissionCommand{
		Resource:          "folders",
		ResourceID:        uid,
		ResourceAttribute: "uid",
	}, nil)

	// remove org role children permissions from folder
	for _, c := range role.Children() {
		_, _ = store.SetBuiltInResourcePermission(context.Background(), orgID, string(c), resourcepermissions.SetResourcePermissionCommand{
			Resource:          "folders",
			ResourceID:        uid,
			ResourceAttribute: "uid",
		}, nil)
	}
}
