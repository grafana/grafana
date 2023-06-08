package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	alertingModels "github.com/grafana/alerting/models"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
)

const (
	TESTDATA_UID = "testdata"
)

func TestGrafanaRuleConfig(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		EnableFeatureToggles:  []string{},
		EnableLog:             false,
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)

	userId := createUser(t, env.SQLStore, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apiCli := newAlertingApiClient(grafanaListedAddr, "admin", "admin")

	dsCmd := &datasources.AddDataSourceCommand{
		Name:   "TestDatasource",
		Type:   "testdata",
		Access: datasources.DS_ACCESS_PROXY,
		UID:    TESTDATA_UID,
		UserID: userId,
		OrgID:  1,
	}
	_, err := env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), dsCmd)
	require.NoError(t, err)

	genRule := func(ruleGen func() apimodels.PostableExtendedRuleNode) apimodels.PostableExtendedRuleNodeExtended {
		return apimodels.PostableExtendedRuleNodeExtended{
			Rule:           ruleGen(),
			NamespaceUID:   "NamespaceUID",
			NamespaceTitle: "NamespaceTitle",
		}
	}

	t.Run("valid rule should accept request", func(t *testing.T) {
		status, body := apiCli.SubmitRuleForTesting(t, genRule(alertRuleGen()))
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
	})

	t.Run("valid rule should return alerts in response", func(t *testing.T) {
		status, body := apiCli.SubmitRuleForTesting(t, genRule(alertRuleGen()))
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 1)
	})

	t.Run("valid rule should return static annotations", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Annotations = map[string]string{
			"foo":  "bar",
			"foo2": "bar2",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		for _, alert := range result {
			require.Equal(t, "bar", alert.Annotations["foo"])
			require.Equal(t, "bar2", alert.Annotations["foo2"])
		}
	})

	t.Run("valid rule should return static labels", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Labels = map[string]string{
			"foo":  "bar",
			"foo2": "bar2",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		for _, alert := range result {
			require.Equal(t, "bar", alert.Labels["foo"])
			require.Equal(t, "bar2", alert.Labels["foo2"])
		}
	})

	t.Run("valid rule should return interpolated annotations", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Annotations = map[string]string{
			"value":    "{{ $value }}",
			"values.B": "{{ $values.B }}",
			"values.C": "{{ $values.C }}",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		labels := []string{"GA", "FL", "AL", "AZ"}
		for i, alert := range result {
			require.NotEmpty(t, alert.Annotations["values.B"])
			require.NotEmpty(t, alert.Annotations["values.C"])
			valueB := fmt.Sprintf("[ var='B' labels={state=%s} value=%s ]", labels[i], alert.Annotations["values.B"])
			valueC := fmt.Sprintf("[ var='C' labels={state=%s} value=%s ]", labels[i], alert.Annotations["values.C"])
			require.Contains(t, alert.Annotations["value"], valueB)
			require.Contains(t, alert.Annotations["value"], valueC)
		}
	})

	t.Run("valid rule should return interpolated labels", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Labels = map[string]string{
			"value":    "{{ $value }}",
			"values.B": "{{ $values.B }}",
			"values.C": "{{ $values.C }}",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		labels := []string{"GA", "FL", "AL", "AZ"}
		for i, alert := range result {
			require.NotEmpty(t, alert.Labels["values.B"])
			require.NotEmpty(t, alert.Labels["values.C"])
			valueB := fmt.Sprintf("[ var='B' labels={state=%s} value=%s ]", labels[i], alert.Labels["values.B"])
			valueC := fmt.Sprintf("[ var='C' labels={state=%s} value=%s ]", labels[i], alert.Labels["values.C"])
			require.Contains(t, alert.Labels["value"], valueB)
			require.Contains(t, alert.Labels["value"], valueC)
		}
	})

	t.Run("valid rule should use functions with annotations", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Annotations = map[string]string{
			"externalURL": "{{ externalURL }}",
			"humanize":    "{{ humanize 1000.0 }}",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		for _, alert := range result {
			require.Equal(t, "http://localhost:3000/", alert.Annotations["externalURL"])
			require.Equal(t, "1k", alert.Annotations["humanize"])
		}
	})

	t.Run("valid rule should use functions with labels", func(t *testing.T) {
		rule := genRule(testDataRule())
		rule.Rule.Labels = map[string]string{
			"externalURL": "{{ externalURL }}",
			"humanize":    "{{ humanize 1000.0 }}",
		}
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		for _, alert := range result {
			require.Equal(t, "http://localhost:3000/", alert.Labels["externalURL"])
			require.Equal(t, "1k", alert.Labels["humanize"])
		}
	})

	t.Run("valid rule should return dynamic labels", func(t *testing.T) {
		rule := genRule(testDataRule())
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		labels := []string{"GA", "FL", "AL", "AZ"}
		for i, alert := range result {
			require.Equal(t, labels[i], alert.Labels["state"])
		}
	})

	t.Run("valid rule should return built-in labels", func(t *testing.T) {
		rule := genRule(testDataRule())
		status, body := apiCli.SubmitRuleForTesting(t, rule)
		require.Equal(t, http.StatusOK, status)
		var result []amv2.PostableAlert
		require.NoErrorf(t, json.Unmarshal([]byte(body), &result), "cannot parse response to data frame")
		require.Len(t, result, 4)
		for _, alert := range result {
			require.Equal(t, rule.Rule.GrafanaManagedAlert.Title, alert.Labels[model.AlertNameLabel])
			require.Equal(t, rule.NamespaceUID, alert.Labels[alertingModels.NamespaceUIDLabel])
			require.Equal(t, rule.NamespaceTitle, alert.Labels[ngmodels.FolderTitleLabel])
		}
	})

	t.Run("invalid rule should reject request", func(t *testing.T) {
		req := genRule(alertRuleGen())
		req.Rule = apimodels.PostableExtendedRuleNode{}
		status, _ := apiCli.SubmitRuleForTesting(t, req)
		require.Equal(t, http.StatusBadRequest, status)
	})

	t.Run("authentication permissions", func(t *testing.T) {
		if !setting.IsEnterprise {
			t.Skip("Enterprise-only test")
		}

		testUserId := createUser(t, env.SQLStore, user.CreateUserCommand{
			DefaultOrgRole: "DOESNOTEXIST", // Needed so that the SignedInUser has OrgId=1. Otherwise, datasource will not be found.
			Password:       "test",
			Login:          "test",
		})

		testUserApiCli := newAlertingApiClient(grafanaListedAddr, "test", "test")

		t.Run("fail if can't read rules", func(t *testing.T) {
			status, body := testUserApiCli.SubmitRuleForTesting(t, genRule(testDataRule()))
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
			status, body := testUserApiCli.SubmitRuleForTesting(t, genRule(testDataRule()))
			require.Contains(t, body, "user is not authorized to query one or many data sources used by the rule")
			require.Equalf(t, http.StatusUnauthorized, status, "Response: %s", body)
		})

		_, err = permissionsStore.SetUserResourcePermission(context.Background(),
			accesscontrol.GlobalOrgID,
			accesscontrol.User{ID: testUserId},
			resourcepermissions.SetResourcePermissionCommand{
				Actions: []string{
					datasources.ActionQuery,
				},
				Resource:          "datasources",
				ResourceID:        TESTDATA_UID,
				ResourceAttribute: "uid",
			}, nil)
		require.NoError(t, err)
		testUserApiCli.ReloadCachedPermissions(t)

		t.Run("succeed if can query data sources", func(t *testing.T) {
			status, body := testUserApiCli.SubmitRuleForTesting(t, genRule(testDataRule()))
			require.Equalf(t, http.StatusOK, status, "Response: %s", body)
		})
	})
}

func testDataRule() func() apimodels.PostableExtendedRuleNode {
	return func() apimodels.PostableExtendedRuleNode {
		forDuration := model.Duration(10 * time.Second)
		return apimodels.PostableExtendedRuleNode{
			ApiRuleNode: &apimodels.ApiRuleNode{
				For:         &forDuration,
				Labels:      map[string]string{"label1": "val1"},
				Annotations: map[string]string{"annotation1": "val1"},
			},
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     fmt.Sprintf("rule-%s", util.GenerateShortUID()),
				Condition: "C",
				Data: []apimodels.AlertQuery{
					{
						RefID: "A",
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Hour),
							To:   apimodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: TESTDATA_UID,
						Model: json.RawMessage(`{
								  "refId": "A",
								  "hide": false,
								  "scenarioId": "usa",
								  "usa": {
									"mode": "timeseries",
									"period": "1m",
									"states": [
									  "GA", "FL", "AL", "AZ"
									],
									"fields": [
									  "baz"
									]
								  }
								}`),
					},
					{
						RefID: "B",
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Hour),
							To:   apimodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: expr.DatasourceUID,
						Model: json.RawMessage(`{
								  "refId": "B",
								  "hide": false,
								  "type": "reduce",
								  "datasource": {
									"uid": "__expr__",
									"type": "__expr__"
								  },
								  "conditions": [
									{
									  "type": "query",
									  "evaluator": {
										"params": [],
										"type": "gt"
									  },
									  "operator": {
										"type": "and"
									  },
									  "query": {
										"params": [
										  "B"
										]
									  },
									  "reducer": {
										"params": [],
										"type": "last"
									  }
									}
								  ],
								  "reducer": "last",
								  "expression": "A"
								}`),
					},
					{
						RefID: "C",
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Hour),
							To:   apimodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: expr.DatasourceUID,
						Model: json.RawMessage(`{
							  "refId": "C",
							  "hide": false,
							  "type": "threshold",
							  "datasource": {
								"uid": "__expr__",
								"type": "__expr__"
							  },
							  "conditions": [
								{
								  "type": "query",
								  "evaluator": {
									"params": [
									  0
									],
									"type": "gt"
								  },
								  "operator": {
									"type": "and"
								  },
								  "query": {
									"params": [
									  "C"
									]
								  },
								  "reducer": {
									"params": [],
									"type": "last"
								  }
								}
							  ],
							  "expression": "B"
							}`),
					},
				},
			},
		}
	}
}
