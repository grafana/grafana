package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
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

type Response struct {
	Message string `json:"message"`
	TraceID string `json:"traceID"`
}

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
		Title:                gettable.Title,
		Condition:            gettable.Condition,
		Data:                 gettable.Data,
		UID:                  gettable.UID,
		NoDataState:          gettable.NoDataState,
		ExecErrState:         gettable.ExecErrState,
		IsPaused:             &gettable.IsPaused,
		NotificationSettings: gettable.NotificationSettings,
		Metadata:             gettable.Metadata,
	}
}

type apiClient struct {
	url                              string
	prometheusConversionUseLokiPaths bool
}

type LegacyApiClient struct {
	apiClient
}

func NewAlertingLegacyAPIClient(host, user, pass string) LegacyApiClient {
	cli := newAlertingApiClient(host, user, pass)
	return LegacyApiClient{
		apiClient: cli,
	}
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

// AssignReceiverPermission sends a request to access control API to assign permissions to a user, role, or team on a receiver.
func (a apiClient) AssignReceiverPermission(t *testing.T, receiverUID string, cmd accesscontrol.SetResourcePermissionCommand) (int, string) {
	t.Helper()

	var assignment string
	var assignTo string
	if cmd.UserID != 0 {
		assignment = "users"
		assignTo = fmt.Sprintf("%d", cmd.UserID)
	} else if cmd.TeamID != 0 {
		assignment = "teams"
		assignTo = fmt.Sprintf("%d", cmd.TeamID)
	} else {
		assignment = "builtInRoles"
		assignTo = cmd.BuiltinRole
	}

	body := strings.NewReader(fmt.Sprintf(`{"permission": "%s"}`, cmd.Permission))
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/access-control/receivers/%s/%s/%s", a.url, receiverUID, assignment, assignTo), body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	require.NotNil(t, resp)

	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp.StatusCode, string(b)
}

// CreateFolder creates a folder for storing our alerts, and then refreshes the permission cache to make sure that following requests will be accepted
func (a apiClient) CreateFolder(t *testing.T, uID string, title string, parentUID ...string) {
	t.Helper()
	cmd := folder.CreateFolderCommand{
		UID:   uID,
		Title: title,
	}
	if len(parentUID) > 0 {
		cmd.ParentUID = parentUID[0]
	}

	blob, err := json.Marshal(cmd)
	require.NoError(t, err)

	payload := string(blob)
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

func (a apiClient) ReloadAlertingFileProvisioning(t *testing.T) {
	t.Helper()

	u := fmt.Sprintf("%s/api/admin/provisioning/alerting/reload", a.url)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", nil)
	defer func() {
		require.NoError(t, resp.Body.Close())
	}()
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
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

func (a apiClient) PostRulesGroupWithStatus(t *testing.T, folder string, group *apimodels.PostableRuleGroupConfig, permanentlyDelete bool) (apimodels.UpdateRuleGroupResponse, int, string) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(group)
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s", a.url, folder)
	uri, err := url.Parse(u)
	require.NoError(t, err)
	q := uri.Query()
	if permanentlyDelete {
		q.Set("deletePermanently", "true")
	}
	uri.RawQuery = q.Encode()
	u = uri.String()
	// nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var m apimodels.UpdateRuleGroupResponse
	if resp.StatusCode == http.StatusAccepted {
		require.NoError(t, json.Unmarshal(b, &m))
	}
	return m, resp.StatusCode, string(b)
}

func (a apiClient) PostRulesGroup(t *testing.T, folder string, group *apimodels.PostableRuleGroupConfig, permanentlyDelete bool) apimodels.UpdateRuleGroupResponse {
	t.Helper()
	m, status, raw := a.PostRulesGroupWithStatus(t, folder, group, permanentlyDelete)
	requireStatusCode(t, http.StatusAccepted, status, raw)
	return m
}

func (a apiClient) PostRulesExportWithStatus(t *testing.T, folder string, group *apimodels.PostableRuleGroupConfig, params *apimodels.ExportQueryParams) (int, string) {
	t.Helper()
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(group)
	require.NoError(t, err)

	u, err := url.Parse(fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s/export", a.url, folder))
	require.NoError(t, err)

	if params != nil {
		q := url.Values{}
		if params.Format != "" {
			q.Set("format", params.Format)
		}
		if params.Download {
			q.Set("download", "true")
		}
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequest(http.MethodPost, u.String(), &buf)
	req.Header.Add("Content-Type", "application/json")
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

func (a apiClient) DeleteRulesGroup(t *testing.T, folder string, group string, permanently bool) (int, string) {
	t.Helper()

	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s/%s", a.url, folder, group)
	req, err := http.NewRequest(http.MethodDelete, u, nil)
	require.NoError(t, err)

	if permanently {
		req.URL.RawQuery = url.Values{"deletePermanently": []string{"true"}}.Encode()
	}

	resp, status, err := sendRequestRaw(t, req)
	require.NoError(t, err)

	return status, string(resp)
}

func (a apiClient) PostSilence(t *testing.T, s apimodels.PostableSilence) (apimodels.PostSilencesOKBody, int, string) {
	t.Helper()

	b, err := json.Marshal(s)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/alertmanager/grafana/api/v2/silences", a.url), bytes.NewReader(b))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	return sendRequestJSON[apimodels.PostSilencesOKBody](t, req, http.StatusAccepted)
}

func (a apiClient) GetSilence(t *testing.T, id string) (apimodels.GettableSilence, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/alertmanager/grafana/api/v2/silence/%s", a.url, id), nil)
	require.NoError(t, err)
	return sendRequestJSON[apimodels.GettableSilence](t, req, http.StatusOK)
}

func (a apiClient) GetSilences(t *testing.T, filters ...string) (apimodels.GettableSilences, int, string) {
	t.Helper()

	u, err := url.Parse(fmt.Sprintf("%s/api/alertmanager/grafana/api/v2/silences", a.url))
	require.NoError(t, err)
	if len(filters) > 0 {
		u.RawQuery = url.Values{"filter": filters}.Encode()
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.GettableSilences](t, req, http.StatusOK)
}

func (a apiClient) DeleteSilence(t *testing.T, id string) (any, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/alertmanager/grafana/api/v2/silence/%s", a.url, id), nil)
	require.NoError(t, err)

	type dynamic struct {
		Message string `json:"message"`
	}

	return sendRequestJSON[dynamic](t, req, http.StatusOK)
}

func (a apiClient) GetRulesGroup(t *testing.T, folder string, group string) (apimodels.RuleGroupConfigResponse, int) {
	result, status, _ := a.GetRulesGroupWithStatus(t, folder, group)
	return result, status
}

func (a apiClient) GetRulesGroupWithStatus(t *testing.T, folder string, group string) (apimodels.RuleGroupConfigResponse, int, []byte) {
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

	result := apimodels.RuleGroupConfigResponse{}

	if http.StatusAccepted == resp.StatusCode {
		require.NoError(t, json.Unmarshal(b, &result))
	}
	return result, resp.StatusCode, b
}

func (a apiClient) GetAllRulesGroupInFolderWithStatus(t *testing.T, folder string) (apimodels.NamespaceConfigResponse, int, []byte) {
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

	result := apimodels.NamespaceConfigResponse{}
	if http.StatusAccepted == resp.StatusCode {
		require.NoError(t, json.Unmarshal(b, &result))
	}
	return result, resp.StatusCode, b
}

func (a apiClient) GetAllRulesWithStatus(t *testing.T) (apimodels.NamespaceConfigResponse, int, []byte) {
	t.Helper()
	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules", a.url)
	// nolint:gosec
	resp, err := http.Get(u)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	result := apimodels.NamespaceConfigResponse{}
	if http.StatusOK == resp.StatusCode {
		require.NoError(t, json.Unmarshal(b, &result))
	}
	return result, resp.StatusCode, b
}

func (a apiClient) GetDeletedRulesWithStatus(t *testing.T) (apimodels.NamespaceConfigResponse, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules", a.url), nil)
	require.NoError(t, err)
	q := req.URL.Query()
	q.Add("deleted", "true")
	req.URL.RawQuery = q.Encode()
	return sendRequestJSON[apimodels.NamespaceConfigResponse](t, req, http.StatusOK)
}

func (a apiClient) DeleteRuleFromTrashByGUID(t *testing.T, ruleGUID string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/ruler/grafana/api/v1/trash/rule/guid/%s", a.url, ruleGUID), nil)
	require.NoError(t, err)
	raw, status, err := sendRequestRaw(t, req)
	require.NoError(t, err)
	return status, string(raw)
}

func (a apiClient) ExportRulesWithStatus(t *testing.T, params *apimodels.AlertRulesExportParameters) (int, string) {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/ruler/grafana/api/v1/export/rules", a.url))
	require.NoError(t, err)
	if params != nil {
		q := url.Values{}
		if params.Format != "" {
			q.Set("format", params.Format)
		}
		if params.Download {
			q.Set("download", "true")
		}
		if len(params.FolderUID) > 0 {
			for _, s := range params.FolderUID {
				q.Add("folderUid", s)
			}
		}
		if params.GroupName != "" {
			q.Set("group", params.GroupName)
		}
		if params.RuleUID != "" {
			q.Set("ruleUid", params.RuleUID)
		}
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
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

func (a apiClient) GetRuleGroupProvisioning(t *testing.T, folderUID string, groupName string) (apimodels.AlertRuleGroup, int, string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v1/provisioning/folder/%s/rule-groups/%s", a.url, folderUID, groupName), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.AlertRuleGroup](t, req, http.StatusOK)
}

func (a apiClient) CreateOrUpdateRuleGroupProvisioning(t *testing.T, group apimodels.AlertRuleGroup) (apimodels.AlertRuleGroup, int, string) {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(group)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/provisioning/folder/%s/rule-groups/%s", a.url, group.FolderUID, group.Title), &buf)
	require.NoError(t, err)
	req.Header.Add("Content-Type", "application/json")

	return sendRequestJSON[apimodels.AlertRuleGroup](t, req, http.StatusOK)
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

	return a.CreateDatasource(t, "testdata")
}

func (a apiClient) CreateDatasource(t *testing.T, dsType string) (result api.CreateOrUpdateDatasourceResponse) {
	t.Helper()

	payload := fmt.Sprintf(`{"name":"TestDatasource-%s","type":"%s","access":"proxy","isDefault":false}`, uuid.NewString(), dsType)
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

func (a apiClient) GetAllMuteTimingsWithStatus(t *testing.T) (apimodels.MuteTimings, int, string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v1/provisioning/mute-timings", a.url), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.MuteTimings](t, req, http.StatusOK)
}

func (a apiClient) GetMuteTimingByNameWithStatus(t *testing.T, name string) (apimodels.MuteTimeInterval, int, string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v1/provisioning/mute-timings/%s", a.url, name), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.MuteTimeInterval](t, req, http.StatusOK)
}

func (a apiClient) CreateMuteTimingWithStatus(t *testing.T, interval apimodels.MuteTimeInterval) (apimodels.MuteTimeInterval, int, string) {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(interval)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/v1/provisioning/mute-timings", a.url), &buf)
	req.Header.Add("Content-Type", "application/json")
	require.NoError(t, err)

	return sendRequestJSON[apimodels.MuteTimeInterval](t, req, http.StatusCreated)
}

func (a apiClient) EnsureMuteTiming(t *testing.T, interval apimodels.MuteTimeInterval) {
	t.Helper()

	_, status, body := a.CreateMuteTimingWithStatus(t, interval)
	require.Equalf(t, http.StatusCreated, status, body)
}

func (a apiClient) UpdateMuteTimingWithStatus(t *testing.T, interval apimodels.MuteTimeInterval) (apimodels.MuteTimeInterval, int, string) {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(interval)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/provisioning/mute-timings/%s", a.url, interval.Name), &buf)
	req.Header.Add("Content-Type", "application/json")
	require.NoError(t, err)

	return sendRequestJSON[apimodels.MuteTimeInterval](t, req, http.StatusAccepted)
}

func (a apiClient) DeleteMuteTimingWithStatus(t *testing.T, name string) (int, string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/v1/provisioning/mute-timings/%s", a.url, name), nil)
	req.Header.Add("Content-Type", "application/json")
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp.StatusCode, string(body)
}

func (a apiClient) ExportMuteTiming(t *testing.T, name string, format string) string {
	t.Helper()

	u, err := url.Parse(fmt.Sprintf("%s/api/v1/provisioning/mute-timings/%s/export", a.url, name))
	require.NoError(t, err)
	q := url.Values{}
	q.Set("format", format)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	requireStatusCode(t, http.StatusOK, resp.StatusCode, string(body))
	return string(body)
}

func (a apiClient) GetRouteWithStatus(t *testing.T) (apimodels.Route, int, string) {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v1/provisioning/policies", a.url), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.Route](t, req, http.StatusOK)
}

func (a apiClient) GetRoute(t *testing.T) apimodels.Route {
	t.Helper()

	route, status, data := a.GetRouteWithStatus(t)
	requireStatusCode(t, http.StatusOK, status, data)
	return route
}

func (a apiClient) UpdateRouteWithStatus(t *testing.T, route apimodels.Route, noProvenance bool) (int, string) {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(route)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/provisioning/policies", a.url), &buf)
	req.Header.Add("Content-Type", "application/json")
	if noProvenance {
		req.Header.Add("X-Disable-Provenance", "true")
	}
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return resp.StatusCode, string(body)
}

func (a apiClient) ExportNotificationPolicy(t *testing.T, format string) string {
	t.Helper()

	u, err := url.Parse(fmt.Sprintf("%s/api/v1/provisioning/policies/export", a.url))
	require.NoError(t, err)
	q := url.Values{}
	q.Set("format", format)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	requireStatusCode(t, http.StatusOK, resp.StatusCode, string(body))
	return string(body)
}

func (a apiClient) UpdateRoute(t *testing.T, route apimodels.Route, noProvenance bool) {
	t.Helper()
	status, data := a.UpdateRouteWithStatus(t, route, noProvenance)
	requireStatusCode(t, http.StatusAccepted, status, data)
}

func (a apiClient) GetRuleHistoryWithStatus(t *testing.T, ruleUID string) (data.Frame, int, string) {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/v1/rules/history", a.url))
	require.NoError(t, err)
	q := url.Values{}
	q.Set("ruleUID", ruleUID)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	return sendRequestJSON[data.Frame](t, req, http.StatusOK)
}

func (a apiClient) CreateReceiverWithStatus(t *testing.T, receiver apimodels.EmbeddedContactPoint) (apimodels.EmbeddedContactPoint, int, string) {
	t.Helper()

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(receiver)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/v1/provisioning/contact-points", a.url), &buf)
	req.Header.Add("Content-Type", "application/json")
	require.NoError(t, err)

	return sendRequestJSON[apimodels.EmbeddedContactPoint](t, req, http.StatusAccepted)
}

func (a apiClient) EnsureReceiver(t *testing.T, receiver apimodels.EmbeddedContactPoint) {
	t.Helper()

	_, status, body := a.CreateReceiverWithStatus(t, receiver)
	require.Equalf(t, http.StatusAccepted, status, body)
}

func (a apiClient) ExportReceiver(t *testing.T, name string, format string, decrypt bool) string {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/v1/provisioning/contact-points/export", a.url))
	require.NoError(t, err)
	q := url.Values{}
	q.Set("name", name)
	q.Set("format", format)
	q.Set("decrypt", fmt.Sprintf("%v", decrypt))
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	require.NoError(t, err)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)

	defer func() {
		_ = resp.Body.Close()
	}()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	requireStatusCode(t, http.StatusOK, resp.StatusCode, string(body))
	return string(body)
}

func (a apiClient) ExportReceiverTyped(t *testing.T, name string, decrypt bool) apimodels.ContactPointExport {
	t.Helper()

	response := a.ExportReceiver(t, name, "json", decrypt)

	var export apimodels.AlertingFileExport
	require.NoError(t, json.Unmarshal([]byte(response), &export))
	require.Len(t, export.ContactPoints, 1)
	return export.ContactPoints[0]
}

func (a apiClient) GetAlertmanagerConfigWithStatus(t *testing.T) (apimodels.GettableUserConfig, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/alertmanager/grafana/config/api/v1/alerts", a.url), nil)
	require.NoError(t, err)

	return sendRequestJSON[apimodels.GettableUserConfig](t, req, http.StatusOK)
}

func (a apiClient) GetActiveAlertsWithStatus(t *testing.T) (apimodels.AlertGroups, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/alertmanager/grafana/api/v2/alerts/groups", a.url), nil)
	require.NoError(t, err)
	return sendRequestJSON[apimodels.AlertGroups](t, req, http.StatusOK)
}

func (a apiClient) GetRuleVersionsWithStatus(t *testing.T, ruleUID string) (apimodels.GettableRuleVersions, int, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/ruler/grafana/api/v1/rule/%s/versions", a.url, ruleUID), nil)
	require.NoError(t, err)
	return sendRequestJSON[apimodels.GettableRuleVersions](t, req, http.StatusOK)
}

func (a apiClient) GetRuleByUID(t *testing.T, ruleUID string) apimodels.GettableExtendedRuleNode {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/ruler/grafana/api/v1/rule/%s", a.url, ruleUID), nil)
	require.NoError(t, err)
	rule, status, raw := sendRequestJSON[apimodels.GettableExtendedRuleNode](t, req, http.StatusOK)
	requireStatusCode(t, http.StatusOK, status, raw)
	return rule
}

func (a apiClient) ConvertPrometheusPostRuleGroups(t *testing.T, datasourceUID string, promNamespaces map[string][]apimodels.PrometheusRuleGroup, headers map[string]string) apimodels.ConvertPrometheusResponse {
	t.Helper()

	resp, status, body := a.RawConvertPrometheusPostRuleGroups(t, datasourceUID, promNamespaces, headers)
	requireStatusCode(t, http.StatusAccepted, status, body)

	return resp
}

func (a apiClient) RawConvertPrometheusPostRuleGroups(t *testing.T, datasourceUID string, promNamespaces map[string][]apimodels.PrometheusRuleGroup, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules"
	}

	// Based on the content-type header, marshal the data to JSON or YAML
	contentType := headers["Content-Type"]
	var data []byte
	var err error
	if contentType == "application/json" {
		data, err = json.Marshal(promNamespaces)
		require.NoError(t, err)
	} else {
		data, err = yaml.Marshal(promNamespaces)
		require.NoError(t, err)
	}

	buf := bytes.NewReader(data)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(path, a.url), buf)
	require.NoError(t, err)
	req.Header.Set("X-Grafana-Alerting-Datasource-UID", datasourceUID)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) ConvertPrometheusPostRuleGroup(t *testing.T, namespaceTitle, datasourceUID string, promGroup apimodels.PrometheusRuleGroup, headers map[string]string) apimodels.ConvertPrometheusResponse {
	t.Helper()

	resp, status, body := a.RawConvertPrometheusPostRuleGroup(t, namespaceTitle, datasourceUID, promGroup, headers)
	requireStatusCode(t, http.StatusAccepted, status, body)

	return resp
}

func (a apiClient) RawConvertPrometheusPostRuleGroup(t *testing.T, namespaceTitle, datasourceUID string, promGroup apimodels.PrometheusRuleGroup, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules/%s"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules/%s"
	}

	// Based on the content-type header, marshal the data to JSON or YAML
	contentType := headers["Content-Type"]
	var data []byte
	var err error
	if contentType == "application/json" {
		data, err = json.Marshal(promGroup)
		require.NoError(t, err)
	} else {
		data, err = yaml.Marshal(promGroup)
		require.NoError(t, err)
	}

	buf := bytes.NewReader(data)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(path, a.url, namespaceTitle), buf)
	require.NoError(t, err)
	req.Header.Set("X-Grafana-Alerting-Datasource-UID", datasourceUID)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) ConvertPrometheusGetRuleGroupRules(t *testing.T, namespaceTitle, groupName string, headers map[string]string) apimodels.PrometheusRuleGroup {
	t.Helper()

	rule, status, raw := a.RawConvertPrometheusGetRuleGroupRules(t, namespaceTitle, groupName, headers)
	requireStatusCode(t, http.StatusOK, status, raw)

	return rule
}

func (a apiClient) RawConvertPrometheusGetRuleGroupRules(t *testing.T, namespaceTitle, groupName string, headers map[string]string) (apimodels.PrometheusRuleGroup, int, string) {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules/%s/%s"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules/%s/%s"
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(path, a.url, namespaceTitle, groupName), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	rule, status, raw := sendRequestYAML[apimodels.PrometheusRuleGroup](t, req, http.StatusOK)

	return rule, status, raw
}

func (a apiClient) ConvertPrometheusGetNamespaceRules(t *testing.T, namespaceTitle string, headers map[string]string) map[string][]apimodels.PrometheusRuleGroup {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules/%s"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules/%s"
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(path, a.url, namespaceTitle), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	ns, status, raw := sendRequestYAML[map[string][]apimodels.PrometheusRuleGroup](t, req, http.StatusOK)
	requireStatusCode(t, http.StatusOK, status, raw)

	return ns
}

func (a apiClient) ConvertPrometheusGetAllRules(t *testing.T, headers map[string]string) map[string][]apimodels.PrometheusRuleGroup {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules"
	}

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(path, a.url), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	result, status, raw := sendRequestYAML[map[string][]apimodels.PrometheusRuleGroup](t, req, http.StatusOK)
	requireStatusCode(t, http.StatusOK, status, raw)

	return result
}

func (a apiClient) ConvertPrometheusDeleteRuleGroup(t *testing.T, namespaceTitle, groupName string, headers map[string]string) {
	t.Helper()

	_, status, raw := a.RawConvertPrometheusDeleteRuleGroup(t, namespaceTitle, groupName, headers)
	requireStatusCode(t, http.StatusAccepted, status, raw)
}

func (a apiClient) RawConvertPrometheusDeleteRuleGroup(t *testing.T, namespaceTitle, groupName string, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules/%s/%s"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules/%s/%s"
	}

	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(path, a.url, namespaceTitle, groupName), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) ConvertPrometheusDeleteNamespace(t *testing.T, namespaceTitle string, headers map[string]string) {
	t.Helper()

	_, status, raw := a.RawConvertPrometheusDeleteNamespace(t, namespaceTitle, headers)
	requireStatusCode(t, http.StatusAccepted, status, raw)
}

func (a apiClient) ConvertPrometheusPostAlertmanagerConfig(t *testing.T, amCfg apimodels.AlertmanagerUserConfig, headers map[string]string) apimodels.ConvertPrometheusResponse {
	t.Helper()

	resp, status, body := a.RawConvertPrometheusPostAlertmanagerConfig(t, amCfg, headers)
	requireStatusCode(t, http.StatusAccepted, status, body)

	return resp
}

func (a apiClient) RawConvertPrometheusPostAlertmanagerConfig(t *testing.T, amCfg apimodels.AlertmanagerUserConfig, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/api/v1/alerts"

	// Based on the content-type header, marshal the data to JSON or YAML
	contentType := headers["Content-Type"]
	var data []byte
	var err error
	if contentType == "application/json" {
		data, err = json.Marshal(amCfg)
		require.NoError(t, err)
	} else {
		data, err = yaml.Marshal(amCfg)
		require.NoError(t, err)
	}

	buf := bytes.NewReader(data)

	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(path, a.url), buf)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) ConvertPrometheusGetAlertmanagerConfig(t *testing.T, headers map[string]string) apimodels.AlertmanagerUserConfig {
	t.Helper()

	config, status, raw := a.RawConvertPrometheusGetAlertmanagerConfig(t, headers)
	requireStatusCode(t, http.StatusOK, status, raw)

	return config
}

func (a apiClient) RawConvertPrometheusGetAlertmanagerConfig(t *testing.T, headers map[string]string) (apimodels.AlertmanagerUserConfig, int, string) {
	t.Helper()

	path := "%s/api/convert/api/v1/alerts"

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(path, a.url), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	config, status, raw := sendRequestYAML[apimodels.AlertmanagerUserConfig](t, req, http.StatusOK)

	return config, status, raw
}

func (a apiClient) ConvertPrometheusDeleteAlertmanagerConfig(t *testing.T, headers map[string]string) {
	t.Helper()

	_, status, raw := a.RawConvertPrometheusDeleteAlertmanagerConfig(t, headers)
	requireStatusCode(t, http.StatusAccepted, status, raw)
}

func (a apiClient) RawConvertPrometheusDeleteAlertmanagerConfig(t *testing.T, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/api/v1/alerts"

	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(path, a.url), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) RawConvertPrometheusDeleteNamespace(t *testing.T, namespaceTitle string, headers map[string]string) (apimodels.ConvertPrometheusResponse, int, string) {
	t.Helper()

	path := "%s/api/convert/prometheus/config/v1/rules/%s"
	if a.prometheusConversionUseLokiPaths {
		path = "%s/api/convert/api/prom/rules/%s"
	}

	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf(path, a.url, namespaceTitle), nil)
	require.NoError(t, err)

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return sendRequestJSON[apimodels.ConvertPrometheusResponse](t, req, http.StatusAccepted)
}

func (a apiClient) UpdateNamespaceRules(t *testing.T, folder string, body *apimodels.UpdateNamespaceRulesRequest) (apimodels.UpdateNamespaceRulesResponse, int, string) {
	t.Helper()

	client := &http.Client{}

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(body)
	require.NoError(t, err)

	u := fmt.Sprintf("%s/api/ruler/grafana/api/v1/rules/%s", a.url, folder)

	req, err := http.NewRequest(http.MethodPatch, u, &buf)
	req.Header.Set("Content-Type", "application/json")
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := client.Do(req)
	require.NoError(t, err)
	defer func() {
		_ = resp.Body.Close()
	}()
	b, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var m apimodels.UpdateNamespaceRulesResponse
	if resp.StatusCode == http.StatusAccepted {
		require.NoError(t, json.Unmarshal(b, &m))
	}
	return m, resp.StatusCode, string(b)
}

func sendRequestRaw(t *testing.T, req *http.Request) ([]byte, int, error) {
	t.Helper()
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	return body, resp.StatusCode, nil
}

func sendRequestJSON[T any](t *testing.T, req *http.Request, successStatusCode int) (T, int, string) {
	t.Helper()
	var result T

	body, statusCode, err := sendRequestRaw(t, req)
	require.NoError(t, err)

	if statusCode != successStatusCode {
		return result, statusCode, string(body)
	}

	err = json.Unmarshal(body, &result)
	require.NoError(t, err)
	return result, statusCode, string(body)
}

func sendRequestYAML[T any](t *testing.T, req *http.Request, successStatusCode int) (T, int, string) {
	t.Helper()
	var result T

	body, statusCode, err := sendRequestRaw(t, req)
	require.NoError(t, err)

	if statusCode != successStatusCode {
		return result, statusCode, string(body)
	}

	err = yaml.Unmarshal(body, &result)
	require.NoError(t, err)
	return result, statusCode, string(body)
}

func requireStatusCode(t *testing.T, expected, actual int, response string) {
	t.Helper()
	require.Equalf(t, expected, actual, "Unexpected status. Response: %s", response)
}

func createUser(t *testing.T, db db.DB, cfg *setting.Cfg, cmd user.CreateUserCommand) int64 {
	t.Helper()

	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = 1

	quotaService := quotaimpl.ProvideService(db, configprovider.ProvideService(cfg))
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

func (a apiClient) GetProvisioningAlertRuleExport(t *testing.T, ruleUID string, params *apimodels.ExportQueryParams) (int, string) {
	t.Helper()
	u, err := url.Parse(fmt.Sprintf("%s/api/v1/provisioning/alert-rules/%s/export", a.url, ruleUID))
	require.NoError(t, err)
	if params != nil {
		q := url.Values{}
		if params.Format != "" {
			q.Set("format", params.Format)
		}
		if params.Download {
			q.Set("download", "true")
		}
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
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
