package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/expr"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

const defaultAlertmanagerConfigJSON = `
{
	"template_files": null,
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email",
			"group_by": ["grafana_folder", "alertname"]
		},
		"templates": null,
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				},
				"secureFields": {}
			}]
		}]
	}
}
`

func getRequest(t *testing.T, url string, expStatusCode int) *http.Response {
	t.Helper()
	// nolint:gosec
	resp, err := http.Get(url)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, resp.Body.Close())
	})
	if expStatusCode != resp.StatusCode {
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		t.Fatal(string(b))
	}
	return resp
}

func postRequest(t *testing.T, url string, body string, expStatusCode int) *http.Response {
	t.Helper()
	buf := bytes.NewReader([]byte(body))
	// nolint:gosec
	resp, err := http.Post(url, "application/json", buf)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, resp.Body.Close())
	})
	if expStatusCode != resp.StatusCode {
		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		t.Log(string(b))
		require.Equal(t, expStatusCode, resp.StatusCode)
	}
	return resp
}

func getBody(t *testing.T, body io.ReadCloser) string {
	t.Helper()
	b, err := io.ReadAll(body)
	require.NoError(t, err)
	return string(b)
}

type ruleMutator func(r *apimodels.PostableExtendedRuleNode)

func alertRuleGen(mutators ...ruleMutator) func() apimodels.PostableExtendedRuleNode {
	return func() apimodels.PostableExtendedRuleNode {
		forDuration := model.Duration(10 * time.Second)
		rule := apimodels.PostableExtendedRuleNode{
			ApiRuleNode: &apimodels.ApiRuleNode{
				For:         &forDuration,
				Labels:      map[string]string{"label1": "val1"},
				Annotations: map[string]string{"annotation1": "val1"},
			},
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     fmt.Sprintf("rule-%s", util.GenerateShortUID()),
				Condition: "A",
				Data: []apimodels.AlertQuery{
					{
						RefID: "A",
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Hour),
							To:   apimodels.Duration(time.Duration(3) * time.Hour),
						},
						DatasourceUID: expr.DatasourceUID,
						Model: json.RawMessage(`{
								"type": "math",
								"expression": "2 + 3 > 1"
								}`),
					},
				},
			},
		}

		for _, mutator := range mutators {
			mutator(&rule)
		}
		return rule
	}
}

func withDatasourceQuery(uid string) func(r *apimodels.PostableExtendedRuleNode) {
	data := []apimodels.AlertQuery{
		{
			RefID: "A",
			RelativeTimeRange: apimodels.RelativeTimeRange{
				From: apimodels.Duration(600 * time.Second),
				To:   0,
			},
			DatasourceUID: uid,
			Model: json.RawMessage(fmt.Sprintf(`{
	                "refId": "A",
	                "hide": false,
	                "datasource": {
	                    "type": "testdata",
	                    "uid": "%s"
	                },
	                "scenarioId": "random_walk",
	                "seriesCount": 5,
	                "labels": "series=series-$seriesIndex"
	            }`, uid)),
		},
		{
			RefID:         "B",
			DatasourceUID: expr.DatasourceType,
			Model: json.RawMessage(`{
	                "type": "reduce",
	                "reducer": "last",
	                "expression": "A"
	            }`),
		},
		{
			RefID:         "C",
			DatasourceUID: expr.DatasourceType,
			Model: json.RawMessage(`{
	                "refId": "C",
	                "type": "threshold",
	                "conditions": [
	                    {
	                        "type": "query",
	                        "evaluator": {
	                            "params": [
	                                0
	                            ],
	                            "type": "gt"
	                        }
	                    }
	                ],
	                "expression": "B"
	            }`),
		},
	}

	return func(r *apimodels.PostableExtendedRuleNode) {
		r.GrafanaManagedAlert.Data = data
		r.GrafanaManagedAlert.Condition = "C"
	}
}

func generateAlertRuleGroup(rulesCount int, gen func() apimodels.PostableExtendedRuleNode) apimodels.PostableRuleGroupConfig {
	rules := make([]apimodels.PostableExtendedRuleNode, 0, rulesCount)
	for i := 0; i < rulesCount; i++ {
		rules = append(rules, gen())
	}
	return apimodels.PostableRuleGroupConfig{
		Name:     "arulegroup-" + uuid.NewString(),
		Interval: model.Duration(10 * time.Second),
		Rules:    rules,
	}
}

func convertGettableRuleGroupToPostable(gettable apimodels.GettableRuleGroupConfig) apimodels.PostableRuleGroupConfig {
	rules := make([]apimodels.PostableExtendedRuleNode, 0, len(gettable.Rules))
	for _, rule := range gettable.Rules {
		rules = append(rules, convertGettableRuleToPostable(rule))
	}
	return apimodels.PostableRuleGroupConfig{
		Name:     gettable.Name,
		Interval: gettable.Interval,
		Rules:    rules,
	}
}

func convertGettableRuleToPostable(gettable apimodels.GettableExtendedRuleNode) apimodels.PostableExtendedRuleNode {
	return apimodels.PostableExtendedRuleNode{
		ApiRuleNode:         gettable.ApiRuleNode,
		GrafanaManagedAlert: convertGettableGrafanaRuleToPostable(gettable.GrafanaManagedAlert),
	}
}

func convertGettableGrafanaRuleToPostable(gettable *apimodels.GettableGrafanaRule) *apimodels.PostableGrafanaRule {
	if gettable == nil {
		return nil
	}
	return &apimodels.PostableGrafanaRule{
		Title:        gettable.Title,
		Condition:    gettable.Condition,
		Data:         gettable.Data,
		UID:          gettable.UID,
		NoDataState:  gettable.NoDataState,
		ExecErrState: gettable.ExecErrState,
		IsPaused:     &gettable.IsPaused,
	}
}

type apiClient struct {
	url string
}

func newAlertingApiClient(host, user, pass string) apiClient {
	if len(user) == 0 && len(pass) == 0 {
		return apiClient{url: fmt.Sprintf("http://%s", host)}
	}
	return apiClient{url: fmt.Sprintf("http://%s:%s@%s", user, pass, host)}
}

// ReloadCachedPermissions sends a request to access control API to refresh cached user permissions
func (a apiClient) ReloadCachedPermissions(t *testing.T) {
	t.Helper()

	u := fmt.Sprintf("%s/api/access-control/user/permissions?reloadcache=true", a.url)
	// nolint:gosec
	resp, err := http.Get(u)
	defer func() {
		_ = resp.Body.Close()
	}()
	require.NoErrorf(t, err, "failed to reload permissions cache")
	require.Equalf(t, http.StatusOK, resp.StatusCode, "failed to reload permissions cache")
}

// CreateFolder creates a folder for storing our alerts, and then refreshes the permission cache to make sure that following requests will be accepted
func (a apiClient) CreateFolder(t *testing.T, uID string, title string) {
	t.Helper()
	payload := fmt.Sprintf(`{"uid": "%s","title": "%s"}`, uID, title)
	u := fmt.Sprintf("%s/api/folders", a.url)
	r := strings.NewReader(payload)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", r)
	defer func() {
		require.NoError(t, resp.Body.Close())
	}()
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	a.ReloadCachedPermissions(t)
}

func (a apiClient) GetOrgQuotaLimits(t *testing.T, orgID int64) (int64, int64) {
	t.Helper()

	u := fmt.Sprintf("%s/api/orgs/%d/quotas", a.url, orgID)
	// nolint:gosec
	resp, err := http.Get(u)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	results := []quota.QuotaDTO{}
	require.NoError(t, json.Unmarshal(b, &results))

	var limit int64 = 0
	var used int64 = 0
	for _, q := range results {
		if q.Target != string(ngmodels.QuotaTargetSrv) {
			continue
		}
		limit = q.Limit
		used = q.Used
	}
	return limit, used
}

func (a apiClient) UpdateAlertRuleOrgQuota(t *testing.T, orgID int64, limit int64) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(&quota.UpdateQuotaCmd{
		Target: "alert_rule",
		Limit:  limit,
		OrgID:  orgID,
	})
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/orgs/%d/quotas/alert_rule", a.url, orgID)
	// nolint:gosec
	client := &http.Client{}
	req, err := http.NewRequest(http.MethodPut, u, &buf)
	require.NoError(t, err)
	req.Header.Add("Content-Type", "application/json")
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func (a apiClient) PostRulesGroup(t *testing.T, folder string, group *apimodels.PostableRuleGroupConfig) (int, string) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(group)
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s", a.url, folder)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, string(b)
}

func (a apiClient) DeleteRulesGroup(t *testing.T, folder string, group string) (int, string) {
	t.Helper()

	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s/%s", a.url, folder, group)
	req, err := http.NewRequest(http.MethodDelete, u, nil)
	require.NoError(t, err)
	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp.StatusCode, string(b)
}

func (a apiClient) GetRulesGroup(t *testing.T, folder string, group string) apimodels.RuleGroupConfigResponse {
	t.Helper()
	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s/%s", a.url, folder, group)
	// nolint:gosec
	resp, err := http.Get(u)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	result := apimodels.RuleGroupConfigResponse{}
	require.NoError(t, json.Unmarshal(b, &result))
	return result
}

func (a apiClient) GetAllRulesGroupInFolder(t *testing.T, folder string) apimodels.NamespaceConfigResponse {
	t.Helper()
	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s", a.url, folder)
	// nolint:gosec
	resp, err := http.Get(u)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, http.StatusAccepted, resp.StatusCode)

	result := apimodels.NamespaceConfigResponse{}
	require.NoError(t, json.Unmarshal(b, &result))
	return result
}

func (a apiClient) SubmitRuleForBacktesting(t *testing.T, config apimodels.BacktestConfig) (int, string) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(config)
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/v1/rule/backtest", a.url)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, string(b)
}

func (a apiClient) SubmitRuleForTesting(t *testing.T, config apimodels.PostableExtendedRuleNodeExtended) (int, string) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(config)
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/v1/rule/test/grafana", a.url)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return resp.StatusCode, string(b)
}

func (a apiClient) CreateTestDatasource(t *testing.T) (result api.CreateOrUpdateDatasourceResponse) {
	t.Helper()

	payload := fmt.Sprintf(`{"name":"TestData-%s","type":"testdata","access":"proxy","isDefault":false}`, uuid.NewString())
	buf := bytes.Buffer{}
	buf.Write([]byte(payload))

	u := fmt.Sprintf("%s/api/datasources", a.url)

	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	if resp.StatusCode != 200 {
		require.Failf(t, "failed to create data source", "API request to create a datasource failed. Status code: %d, response: %s", resp.StatusCode, string(b))
	}
	require.NoError(t, json.Unmarshal([]byte(fmt.Sprintf(`{ "body": %s }`, string(b))), &result))
	return result
}

func (a apiClient) DeleteDatasource(t *testing.T, uid string) {
	t.Helper()

	u := fmt.Sprintf("%s/api/datasources/uid/%s", a.url, uid)

	req, err := http.NewRequest(http.MethodDelete, u, nil)
	require.NoError(t, err)
	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	if resp.StatusCode != 200 {
		require.Failf(t, "failed to create data source", "API request to create a datasource failed. Status code: %d, response: %s", resp.StatusCode, string(b))
	}
}
