package alerting

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestBacktesting(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingBacktesting,
		},
		EnableLog: false,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	userId := createUser(t, env.SQLStore, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiCli := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	input, err := os.ReadFile(filepath.Join("api_backtesting_data.json"))
	require.NoError(t, err)
	var testData map[string]apimodels.BacktestConfig
	require.NoError(t, json.Unmarshal(input, &testData))

	queryRequest, ok := testData["query"]
	require.Truef(t, ok, "The data file does not contain a field `query`")

	for _, query := range queryRequest.Data {
		isExpr, _ := query.IsExpression()
		if isExpr {
			continue
		}
		t.Logf("Creating a new test data source with UID %s", query.DatasourceUID)
		dsCmd := &datasources.AddDataSourceCommand{
			Name:   "Backtesting-TestDatasource",
			Type:   "testdata",
			Access: datasources.DS_ACCESS_PROXY,
			UID:    query.DatasourceUID,
			UserID: userId,
			OrgID:  1,
		}
		_, err := env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), dsCmd)
		require.NoError(t, err)
		break
	}

	t.Run("and request contains data", func(t *testing.T) {
		t.Run("should accept request", func(t *testing.T) {
			request, ok := testData["data"]
			require.Truef(t, ok, "The data file does not contain a field `data`")

			status, body := apiCli.SubmitRuleForBacktesting(t, request)
			require.Equal(t, http.StatusOK, status)
			var result data.Frame
			require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		})
	})

	t.Run("and request contains query", func(t *testing.T) {
		t.Run("should accept request with query", func(t *testing.T) {
			status, body := apiCli.SubmitRuleForBacktesting(t, queryRequest)
			require.Equalf(t, http.StatusOK, status, "Response: %s", body)
			var result data.Frame
			require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		})
	})

	t.Run("if user does not have permissions", func(t *testing.T) {
		if !setting.IsEnterprise {
			t.Skip("Enterprise-only test")
		}

		testUserId := createUser(t, env.SQLStore, user.CreateUserCommand{
			DefaultOrgRole: "",
			Password:       "test",
			Login:          "test",
		})

		testUserApiCli := newAlertingApiClient(grafanaListedAddr, "test", "test")

		t.Run("fail if can't read rules", func(t *testing.T) {
			status, body := testUserApiCli.SubmitRuleForBacktesting(t, queryRequest)
			require.Contains(t, body, accesscontrol.ActionAlertingRuleRead)
			require.Equalf(t, http.StatusForbidden, status, "Response: %s", body)
		})

		// access control permissions store
		permissionsStore := resourcepermissions.NewStore(env.SQLStore)
		_, err := permissionsStore.SetUserResourcePermission(context.Background(),
			accesscontrol.GlobalOrgID,
			accesscontrol.User{ID: testUserId},
			resourcepermissions.SetResourcePermissionCommand{
				Actions: []string{
					accesscontrol.ActionAlertingRuleRead,
				},
				Resource:          "folders",
				ResourceID:        "*",
				ResourceAttribute: "uid",
			}, nil)
		require.NoError(t, err)
		testUserApiCli.ReloadCachedPermissions(t)

		t.Run("fail if can't query data sources", func(t *testing.T) {
			status, body := testUserApiCli.SubmitRuleForBacktesting(t, queryRequest)
			require.Contains(t, body, "user is not authorized to query one or many data sources used by the rule")
			require.Equalf(t, http.StatusUnauthorized, status, "Response: %s", body)
		})
	})
}
