package api

import (
	"fmt"
	"path"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var allNoData = []apimodels.NoDataState{
	apimodels.OK,
	apimodels.NoData,
	apimodels.Alerting,
}

var allExecError = []apimodels.ExecutionErrorState{
	apimodels.ErrorErrState,
	apimodels.AlertingErrState,
}

func config(t *testing.T) *setting.UnifiedAlertingSettings {
	t.Helper()
	baseInterval := time.Duration(rand.Intn(99)+1) * time.Second
	result := &setting.UnifiedAlertingSettings{
		BaseInterval:                  baseInterval,
		DefaultRuleEvaluationInterval: baseInterval * time.Duration(rand.Intn(9)+1),
	}
	t.Logf("Config Base interval is [%v]", result.BaseInterval)
	return result
}

func validRule() apimodels.PostableExtendedRuleNode {
	forDuration := model.Duration(rand.Int63n(1000))
	return apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For: &forDuration,
			Labels: map[string]string{
				"test-label": "data",
			},
			Annotations: map[string]string{
				"test-annotation": "data",
			},
		},
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     fmt.Sprintf("TEST-ALERT-%d", rand.Int63()),
			Condition: "A",
			Data: []apimodels.AlertQuery{
				{
					RefID:     "A",
					QueryType: "TEST",
					RelativeTimeRange: apimodels.RelativeTimeRange{
						From: 10,
						To:   0,
					},
					DatasourceUID: "DATASOURCE_TEST",
					Model:         nil,
				},
			},
			UID:          util.GenerateShortUID(),
			NoDataState:  allNoData[rand.Intn(len(allNoData))],
			ExecErrState: apimodels.OkErrState, // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
		},
	}
}

func validGroup(cfg *setting.UnifiedAlertingSettings, rules ...apimodels.PostableExtendedRuleNode) apimodels.PostableRuleGroupConfig {
	return apimodels.PostableRuleGroupConfig{
		Name:     "TEST-ALERTS-" + util.GenerateShortUID(),
		Interval: model.Duration(cfg.BaseInterval * time.Duration(rand.Int63n(10))),
		Rules:    rules,
	}
}

func randFolder() *folder.Folder {
	title := "TEST-FOLDER-" + util.GenerateShortUID()
	return &folder.Folder{
		UID:   util.GenerateShortUID(),
		Title: title,
		// URL:       "",
		// Version:   0,
		Created: time.Time{},
		Updated: time.Time{},
		// UpdatedBy: 0,
		// CreatedBy: 0,
		// HasACL:    false,
		ParentUID: uuid.NewString(),
		Fullpath:  path.Join("parent-folder", title),
	}
}

func TestValidateCondition(t *testing.T) {
	testcases := []struct {
		name      string
		condition string
		data      []apimodels.AlertQuery
		errorMsg  string
	}{
		{
			name:      "error when condition is empty",
			condition: "",
			data:      []apimodels.AlertQuery{},
			errorMsg:  "condition cannot be empty",
		},
		{
			name:      "error when data is empty",
			condition: "A",
			data:      []apimodels.AlertQuery{},
			errorMsg:  "no query/expressions specified",
		},
		{
			name:      "error when condition does not exist",
			condition: "A",
			data: []apimodels.AlertQuery{
				{
					RefID: "B",
				},
				{
					RefID: "C",
				},
			},
			errorMsg: "condition A does not exist, must be one of [B,C]",
		},
		{
			name:      "error when duplicated refId",
			condition: "A",
			data: []apimodels.AlertQuery{
				{
					RefID: "A",
				},
				{
					RefID: "A",
				},
			},
			errorMsg: "refID 'A' is already used by query/expression at index 0",
		},
		{
			name:      "error when refId is empty",
			condition: "A",
			data: []apimodels.AlertQuery{
				{
					RefID: "",
				},
				{
					RefID: "A",
				},
			},
			errorMsg: "refID is not specified for data query/expression at index 0",
		},
		{
			name:      "valid case",
			condition: "B",
			data: []apimodels.AlertQuery{
				{
					RefID: "A",
				},
				{
					RefID: "B",
				},
			},
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateCondition(tc.condition, tc.data)
			if tc.errorMsg == "" {
				require.NoError(t, err)
			} else {
				require.ErrorContains(t, err, tc.errorMsg)
			}
		})
	}
}

func TestValidateRuleGroup(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()

	rules := make([]apimodels.PostableExtendedRuleNode, 0, rand.Intn(4)+1)
	for i := 0; i < cap(rules); i++ {
		rules = append(rules, validRule())
	}
	cfg := config(t)

	t.Run("should validate struct and rules", func(t *testing.T) {
		g := validGroup(cfg, rules...)
		alerts, err := validateRuleGroup(&g, orgId, folder, cfg)
		require.NoError(t, err)
		require.Len(t, alerts, len(rules))
	})

	t.Run("should default to default interval from config if group interval is 0", func(t *testing.T) {
		g := validGroup(cfg, rules...)
		g.Interval = 0
		alerts, err := validateRuleGroup(&g, orgId, folder, cfg)
		require.NoError(t, err)
		for _, alert := range alerts {
			require.Equal(t, int64(cfg.DefaultRuleEvaluationInterval.Seconds()), alert.IntervalSeconds)
			require.False(t, alert.HasPause)
		}
	})

	t.Run("should show the payload has isPaused field", func(t *testing.T) {
		for _, rule := range rules {
			isPaused := true
			rule.GrafanaManagedAlert.IsPaused = &isPaused
			isPaused = !(isPaused)
		}
		g := validGroup(cfg, rules...)
		alerts, err := validateRuleGroup(&g, orgId, folder, cfg)
		require.NoError(t, err)
		for _, alert := range alerts {
			require.True(t, alert.HasPause)
		}
	})
}

func TestValidateRuleGroupFailures(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	cfg := config(t)

	testCases := []struct {
		name   string
		group  func() *apimodels.PostableRuleGroupConfig
		assert func(t *testing.T, apiModel *apimodels.PostableRuleGroupConfig, err error)
	}{
		{
			name: "fail if title is empty",
			group: func() *apimodels.PostableRuleGroupConfig {
				g := validGroup(cfg)
				g.Name = ""
				return &g
			},
		},
		{
			name: "fail if title is too long",
			group: func() *apimodels.PostableRuleGroupConfig {
				g := validGroup(cfg)
				for len(g.Name) < store.AlertRuleMaxRuleGroupNameLength {
					g.Name += g.Name
				}
				return &g
			},
		},
		{
			name: "fail if interval is negative",
			group: func() *apimodels.PostableRuleGroupConfig {
				g := validGroup(cfg)
				g.Interval = model.Duration(-(rand.Int63n(1000) + 1))
				return &g
			},
		},
		{
			name: "fail if interval is not aligned with base interval",
			group: func() *apimodels.PostableRuleGroupConfig {
				g := validGroup(cfg)
				g.Interval = model.Duration(cfg.BaseInterval + time.Duration(rand.Intn(10)+1)*time.Second)
				return &g
			},
		},
		{
			name: "fail if two rules have same UID",
			group: func() *apimodels.PostableRuleGroupConfig {
				r1 := validRule()
				r2 := validRule()
				uid := util.GenerateShortUID()
				r1.GrafanaManagedAlert.UID = uid
				r2.GrafanaManagedAlert.UID = uid
				g := validGroup(cfg, r1, r2)
				return &g
			},
			assert: func(t *testing.T, apiModel *apimodels.PostableRuleGroupConfig, err error) {
				require.Contains(t, err.Error(), apiModel.Rules[0].GrafanaManagedAlert.UID)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			g := testCase.group()
			_, err := validateRuleGroup(g, orgId, folder, cfg)
			require.Error(t, err)
			if testCase.assert != nil {
				testCase.assert(t, g, err)
			}
		})
	}
}

func TestValidateRuleNode_NoUID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	name := util.GenerateShortUID()
	var cfg = config(t)
	interval := cfg.BaseInterval * time.Duration(rand.Int63n(10)+1)

	testCases := []struct {
		name   string
		rule   func() *apimodels.PostableExtendedRuleNode
		assert func(t *testing.T, model *apimodels.PostableExtendedRuleNode, rule *models.AlertRule)
	}{
		{
			name: "coverts api model to AlertRule",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, int64(0), alert.ID)
				require.Equal(t, orgId, alert.OrgID)
				require.Equal(t, api.GrafanaManagedAlert.Title, alert.Title)
				require.Equal(t, api.GrafanaManagedAlert.Condition, alert.Condition)
				require.Equal(t, AlertQueriesFromApiAlertQueries(api.GrafanaManagedAlert.Data), alert.Data)
				require.Equal(t, time.Time{}, alert.Updated)
				require.Equal(t, int64(interval.Seconds()), alert.IntervalSeconds)
				require.Equal(t, int64(0), alert.Version)
				require.Equal(t, api.GrafanaManagedAlert.UID, alert.UID)
				require.Equal(t, folder.UID, alert.NamespaceUID)
				require.Nil(t, alert.DashboardUID)
				require.Nil(t, alert.PanelID)
				require.Equal(t, name, alert.RuleGroup)
				require.Equal(t, models.NoDataState(api.GrafanaManagedAlert.NoDataState), alert.NoDataState)
				require.Equal(t, models.ExecutionErrorState(api.GrafanaManagedAlert.ExecErrState), alert.ExecErrState)
				require.Equal(t, time.Duration(*api.ApiRuleNode.For), alert.For)
				require.Equal(t, api.ApiRuleNode.Annotations, alert.Annotations)
				require.Equal(t, api.ApiRuleNode.Labels, alert.Labels)
			},
		},
		{
			name: "coverts api without ApiRuleNode",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode = nil
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, time.Duration(0), alert.For)
				require.Nil(t, alert.Annotations)
				require.Nil(t, alert.Labels)
			},
		},
		{
			name: "defaults to NoData if NoDataState is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.NoDataState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.NoData, alert.NoDataState)
			},
		},
		{
			name: "defaults to OK if ExecErrState is empty", // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.ExecErrState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.OkErrState, alert.ExecErrState) // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
			},
		},
		{
			name: "extracts Dashboard UID and Panel Id from annotations",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      strconv.Itoa(rand.Int()),
				}
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, api.ApiRuleNode.Annotations[models.DashboardUIDAnnotation], *alert.DashboardUID)
				panelId, err := strconv.Atoi(api.ApiRuleNode.Annotations[models.PanelIDAnnotation])
				require.NoError(t, err)
				require.Equal(t, int64(panelId), *alert.PanelID)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()
			r.GrafanaManagedAlert.UID = ""

			alert, err := validateRuleNode(r, name, interval, orgId, folder, cfg)
			require.NoError(t, err)
			testCase.assert(t, r, alert)
		})
	}

	t.Run("accepts empty group name", func(t *testing.T) {
		r := validRule()
		alert, err := validateRuleNode(&r, "", interval, orgId, folder, cfg)
		require.NoError(t, err)
		require.Equal(t, "", alert.RuleGroup)
	})
}

func TestValidateRuleNodeFailures_NoUID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	cfg := config(t)

	testCases := []struct {
		name           string
		interval       *time.Duration
		rule           func() *apimodels.PostableExtendedRuleNode
		assert         func(t *testing.T, model *apimodels.PostableExtendedRuleNode, err error)
		allowedIfNoUId bool
	}{
		{
			name: "fail if GrafanaManagedAlert is not specified",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert = nil
				return &r
			},
		},
		{
			name: "fail if title is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Title = ""
				return &r
			},
		},
		{
			name: "fail if title is too long",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				for len(r.GrafanaManagedAlert.Title) < store.AlertRuleMaxTitleLength {
					r.GrafanaManagedAlert.Title += r.GrafanaManagedAlert.Title
				}
				return &r
			},
		},
		{
			name: "fail if NoDataState is not known",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.NoDataState = apimodels.NoDataState(util.GenerateShortUID())
				return &r
			},
		},
		// LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value - will not fail on unknown ExecErrState
		//{
		//	name: "fail if ExecErrState is not known",
		//	rule: func() *apimodels.PostableExtendedRuleNode {
		//		r := validRule()
		//		r.GrafanaManagedAlert.ExecErrState = apimodels.ExecutionErrorState(util.GenerateShortUID())
		//		return &r
		//	},
		//},
		{
			name: "fail if there are not data (nil)",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = nil
				return &r
			},
		},
		{
			name: "fail if there are not data (empty)",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = make([]apimodels.AlertQuery, 0, 1)
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified but not Panel ID",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified and Panel ID is NaN",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if PanelID is specified but not Dashboard UID ",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.PanelIDAnnotation: "0",
				}
				return &r
			},
		},
		{
			name: "fail if Condition is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Condition = ""
				return &r
			},
		},
		{
			name: "fail if Data is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = nil
				return &r
			},
		},
		{
			name: "fail if Condition does not exist",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Condition = uuid.NewString()
				return &r
			},
		},
		{
			name: "fail if Data has duplicate ref ID",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = append(r.GrafanaManagedAlert.Data, r.GrafanaManagedAlert.Data...)
				return &r
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()
			if r.GrafanaManagedAlert != nil {
				r.GrafanaManagedAlert.UID = ""
			}

			interval := cfg.BaseInterval
			if testCase.interval != nil {
				interval = *testCase.interval
			}

			_, err := validateRuleNode(r, "", interval, orgId, folder, cfg)
			require.Error(t, err)
			if testCase.assert != nil {
				testCase.assert(t, r, err)
			}
		})
	}
}

func TestValidateRuleNode_UID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	name := util.GenerateShortUID()
	var cfg = config(t)
	interval := cfg.BaseInterval * time.Duration(rand.Int63n(10)+1)

	testCases := []struct {
		name   string
		rule   func() *apimodels.PostableExtendedRuleNode
		assert func(t *testing.T, model *apimodels.PostableExtendedRuleNode, rule *models.AlertRule)
	}{
		{
			name: "use empty Title",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Title = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, "", alert.Title)
			},
		},
		{
			name: "use empty NoData if NoDataState is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.NoDataState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.NoDataState(""), alert.NoDataState)
			},
		},
		{
			name: "use OK state if ExecErrState is empty", // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.ExecErrState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.OkErrState, alert.ExecErrState) // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
			},
		},
		{
			name: "use empty Condition and Data if they are empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Condition = ""
				r.GrafanaManagedAlert.Data = nil
				if rand.Int63()%2 == 0 {
					r.GrafanaManagedAlert.Data = make([]apimodels.AlertQuery, 0)
				}
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, "", alert.Condition)
				require.Len(t, alert.Data, 0)
			},
		},
		{
			name: "extracts Dashboard UID and Panel Id from annotations",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      strconv.Itoa(rand.Int()),
				}
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, api.ApiRuleNode.Annotations[models.DashboardUIDAnnotation], *alert.DashboardUID)
				panelId, err := strconv.Atoi(api.ApiRuleNode.Annotations[models.PanelIDAnnotation])
				require.NoError(t, err)
				require.Equal(t, int64(panelId), *alert.PanelID)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()
			alert, err := validateRuleNode(r, name, interval, orgId, folder, cfg)
			require.NoError(t, err)
			testCase.assert(t, r, alert)
		})
	}

	t.Run("accepts empty group name", func(t *testing.T) {
		r := validRule()
		alert, err := validateRuleNode(&r, "", interval, orgId, folder, cfg)
		require.NoError(t, err)
		require.Equal(t, "", alert.RuleGroup)
	})
}

func TestValidateRuleNodeFailures_UID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	cfg := config(t)

	testCases := []struct {
		name     string
		interval *time.Duration
		rule     func() *apimodels.PostableExtendedRuleNode
		assert   func(t *testing.T, model *apimodels.PostableExtendedRuleNode, err error)
	}{
		{
			name: "fail if GrafanaManagedAlert is not specified",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert = nil
				return &r
			},
		},
		{
			name: "fail if title is too long",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				for len(r.GrafanaManagedAlert.Title) < store.AlertRuleMaxTitleLength {
					r.GrafanaManagedAlert.Title += r.GrafanaManagedAlert.Title
				}
				return &r
			},
		},
		{
			name: "fail if there are not data (nil) but condition is set",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = nil
				r.GrafanaManagedAlert.Condition = "A"
				return &r
			},
		},
		{
			name: "fail if there are not data (empty) but condition is set",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Data = make([]apimodels.AlertQuery, 0, 1)
				r.GrafanaManagedAlert.Condition = "A"
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified but not Panel ID",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified and Panel ID is NaN",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if PanelID is specified but not Dashboard UID ",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.ApiRuleNode.Annotations = map[string]string{
					models.PanelIDAnnotation: "0",
				}
				return &r
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()

			interval := cfg.BaseInterval
			if testCase.interval != nil {
				interval = *testCase.interval
			}

			_, err := validateRuleNode(r, "", interval, orgId, folder, cfg)
			require.Error(t, err)
			if testCase.assert != nil {
				testCase.assert(t, r, err)
			}
		})
	}
}

func TestValidateRuleNodeIntervalFailures(t *testing.T) {
	cfg := config(t)

	testCases := []struct {
		name     string
		interval time.Duration
	}{
		{
			name:     "fail if interval is negative",
			interval: -time.Duration(rand.Int63n(10)+1) * time.Second,
		},
		{
			name:     "fail if interval is 0",
			interval: 0,
		},
		{
			name:     "fail if interval is not multiple of base interval",
			interval: cfg.BaseInterval + time.Duration(rand.Int63n(int64(cfg.BaseInterval.Seconds())-2)+1)*time.Second,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := validRule()
			_, err := validateRuleNode(&r, util.GenerateShortUID(), testCase.interval, rand.Int63(), randFolder(), cfg)
			require.Error(t, err)
		})
	}
}

func TestValidateRuleNodeNotificationSettings(t *testing.T) {
	cfg := config(t)

	validNotificationSettings := models.NotificationSettingsGen(models.NSMuts.WithGroupBy(model.AlertNameLabel, models.FolderTitleLabel))

	testCases := []struct {
		name                 string
		notificationSettings models.NotificationSettings
		expErrorContains     string
	}{
		{
			name:                 "valid notification settings",
			notificationSettings: validNotificationSettings(),
		},
		{
			name:                 "missing receiver is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithReceiver("")),
			expErrorContains:     "receiver",
		},
		{
			name:                 "group by empty is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy()),
		},
		{
			name:                 "group by ... is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy("...")),
		},
		{
			name:                 "group by with alert name and folder name labels is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy(model.AlertNameLabel, models.FolderTitleLabel)),
		},
		{
			name:                 "group by missing alert name label is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy(models.FolderTitleLabel)),
			expErrorContains:     model.AlertNameLabel,
		},
		{
			name:                 "group by missing folder name label is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy(model.AlertNameLabel)),
			expErrorContains:     models.FolderTitleLabel,
		},
		{
			name:                 "group wait empty is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupWait(nil)),
		},
		{
			name:                 "group wait positive is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupWait(util.Pointer(1*time.Second))),
		},
		{
			name:                 "group wait negative is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupWait(util.Pointer(-1*time.Second))),
			expErrorContains:     "group wait",
		},
		{
			name:                 "group interval empty is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupInterval(nil)),
		},
		{
			name:                 "group interval positive is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupInterval(util.Pointer(1*time.Second))),
		},
		{
			name:                 "group interval negative is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupInterval(util.Pointer(-1*time.Second))),
			expErrorContains:     "group interval",
		},
		{
			name:                 "repeat interval empty is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithRepeatInterval(nil)),
		},
		{
			name:                 "repeat interval positive is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithRepeatInterval(util.Pointer(1*time.Second))),
		},
		{
			name:                 "repeat interval negative is invalid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithRepeatInterval(util.Pointer(-1*time.Second))),
			expErrorContains:     "repeat interval",
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			r := validRule()
			r.GrafanaManagedAlert.NotificationSettings = AlertRuleNotificationSettingsFromNotificationSettings([]models.NotificationSettings{tt.notificationSettings})
			_, err := validateRuleNode(&r, util.GenerateShortUID(), cfg.BaseInterval*time.Duration(rand.Int63n(10)+1), rand.Int63(), randFolder(), cfg)

			if tt.expErrorContains != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.expErrorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestValidateRuleNodeReservedLabels(t *testing.T) {
	cfg := config(t)

	for label := range models.LabelsUserCannotSpecify {
		t.Run(label, func(t *testing.T) {
			r := validRule()
			r.ApiRuleNode.Labels = map[string]string{
				label: "true",
			}
			_, err := validateRuleNode(&r, util.GenerateShortUID(), cfg.BaseInterval*time.Duration(rand.Int63n(10)+1), rand.Int63(), randFolder(), cfg)
			require.Error(t, err)
			require.ErrorContains(t, err, label)
		})
	}
}
