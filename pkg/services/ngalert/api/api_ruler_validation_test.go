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

	//nolint:staticcheck
	"golang.org/x/exp/rand"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	. "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	. "github.com/grafana/grafana/pkg/services/ngalert/api/validation"
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

func makeLimits(cfg *setting.UnifiedAlertingSettings) RuleLimits {
	baseToggles := featuremgmt.WithFeatures()
	return RuleLimitsFromConfig(cfg, baseToggles)
}

func validRule() apimodels.PostableExtendedRuleNode {
	forDuration := model.Duration(rand.Int63n(1000))
	keepFiringForDuration := model.Duration(rand.Int63n(1000))
	uid := util.GenerateShortUID()
	return apimodels.PostableExtendedRuleNode{
		ApiRuleNode: &apimodels.ApiRuleNode{
			For:           &forDuration,
			KeepFiringFor: &keepFiringForDuration,
			Labels: map[string]string{
				"test-label": "data",
			},
			Annotations: map[string]string{
				"test-annotation": "data",
			},
		},
		GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
			Title:     fmt.Sprintf("TEST-ALERT-%s", uid),
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
			UID:          uid,
			NoDataState:  allNoData[rand.Intn(len(allNoData))],
			ExecErrState: allExecError[rand.Intn(len(allExecError))],
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
			errorMsg:  "no queries or expressions are found",
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
			err := ValidateCondition(tc.condition, tc.data, false)
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
	limits := makeLimits(cfg)

	t.Run("should validate struct and rules", func(t *testing.T) {
		g := validGroup(cfg, rules...)
		alerts, err := ValidateRuleGroup(&g, orgId, folder.UID, limits)
		require.NoError(t, err)
		require.Len(t, alerts, len(rules))
	})

	t.Run("should default to default interval from config if group interval is 0", func(t *testing.T) {
		g := validGroup(cfg, rules...)
		g.Interval = 0
		alerts, err := ValidateRuleGroup(&g, orgId, folder.UID, limits)
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
		alerts, err := ValidateRuleGroup(&g, orgId, folder.UID, limits)
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
	limits := makeLimits(cfg)

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
		{
			name: "fail with 4xx if rule contains only panelID",
			group: func() *apimodels.PostableRuleGroupConfig {
				r1 := validRule()
				panelId := int64(42)
				r1.Annotations = map[string]string{
					models.PanelIDAnnotation: strconv.FormatInt(panelId, 10),
				}
				g := validGroup(cfg, r1)
				return &g
			},
			assert: func(t *testing.T, apiModel *apimodels.PostableRuleGroupConfig, err error) {
				require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
			},
		},
		{
			name: "fail with 4xx if rule contains only dashboardUID",
			group: func() *apimodels.PostableRuleGroupConfig {
				r1 := validRule()
				dashboardUid := "oinwerfgiuac"
				r1.Annotations = map[string]string{
					models.DashboardUIDAnnotation: dashboardUid,
				}
				g := validGroup(cfg, r1)
				return &g
			},
			assert: func(t *testing.T, apiModel *apimodels.PostableRuleGroupConfig, err error) {
				require.ErrorIs(t, err, models.ErrAlertRuleFailedValidation)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			g := testCase.group()
			_, err := ValidateRuleGroup(g, orgId, folder.UID, limits)
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
	limits := makeLimits(cfg)
	interval := cfg.BaseInterval * time.Duration(rand.Int63n(10)+1)

	testCases := []struct {
		name   string
		rule   func() *apimodels.PostableExtendedRuleNode
		limits *RuleLimits
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
				require.Equal(t, time.Duration(*api.For), alert.For)
				require.Equal(t, time.Duration(*api.KeepFiringFor), alert.KeepFiringFor)
				require.Equal(t, api.Annotations, alert.Annotations)
				require.Equal(t, api.Labels, alert.Labels)
				require.Nil(t, alert.Record)
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
				require.Equal(t, time.Duration(0), alert.KeepFiringFor)
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
			name: "defaults to Alerting if ExecErrState is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.ExecErrState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.AlertingErrState, alert.ExecErrState)
			},
		},
		{
			name: "extracts Dashboard UID and Panel Id from annotations",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      strconv.Itoa(rand.Int()),
				}
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, api.Annotations[models.DashboardUIDAnnotation], *alert.DashboardUID)
				panelId, err := strconv.Atoi(api.Annotations[models.PanelIDAnnotation])
				require.NoError(t, err)
				require.Equal(t, int64(panelId), *alert.PanelID)
			},
		},
		{
			name: "accepts and converts recording rule",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Record = &apimodels.Record{Metric: "some_metric", From: "A"}
				r.GrafanaManagedAlert.Condition = ""
				r.GrafanaManagedAlert.NoDataState = ""
				r.GrafanaManagedAlert.ExecErrState = ""
				r.GrafanaManagedAlert.NotificationSettings = nil
				r.For = nil
				r.KeepFiringFor = nil
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				// Shared fields
				require.Equal(t, int64(0), alert.ID)
				require.Equal(t, orgId, alert.OrgID)
				require.Equal(t, api.GrafanaManagedAlert.Title, alert.Title)
				require.Equal(t, AlertQueriesFromApiAlertQueries(api.GrafanaManagedAlert.Data), alert.Data)
				require.Equal(t, time.Time{}, alert.Updated)
				require.Equal(t, int64(interval.Seconds()), alert.IntervalSeconds)
				require.Equal(t, int64(0), alert.Version)
				require.Equal(t, api.GrafanaManagedAlert.UID, alert.UID)
				require.Equal(t, folder.UID, alert.NamespaceUID)
				require.Nil(t, alert.DashboardUID)
				require.Nil(t, alert.PanelID)
				require.Equal(t, name, alert.RuleGroup)
				require.Equal(t, api.Annotations, alert.Annotations)
				require.Equal(t, api.Labels, alert.Labels)
				// Alerting fields
				require.Empty(t, alert.Condition)
				require.Empty(t, alert.NoDataState)
				require.Empty(t, alert.ExecErrState)
				require.Nil(t, alert.NotificationSettings)
				require.Zero(t, alert.For)
				require.Zero(t, alert.KeepFiringFor)
				// Recording fields
				require.Equal(t, api.GrafanaManagedAlert.Record.From, alert.Record.From)
				require.Equal(t, api.GrafanaManagedAlert.Record.Metric, alert.Record.Metric)
			},
		},
		{
			name: "recording rules ignore fields that only make sense for Alerting rules",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Record = &apimodels.Record{Metric: "some_metric", From: "A"}
				r.GrafanaManagedAlert.Condition = "A"
				r.GrafanaManagedAlert.NoDataState = apimodels.OK
				r.GrafanaManagedAlert.ExecErrState = apimodels.AlertingErrState
				r.GrafanaManagedAlert.NotificationSettings = &apimodels.AlertRuleNotificationSettings{}
				r.For = func() *model.Duration { five := model.Duration(time.Second * 5); return &five }()
				r.KeepFiringFor = func() *model.Duration { five := model.Duration(time.Second * 5); return &five }()
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Empty(t, alert.Condition)
				require.Empty(t, alert.NoDataState)
				require.Empty(t, alert.ExecErrState)
				require.Nil(t, alert.NotificationSettings)
				require.Zero(t, alert.For)
				require.Zero(t, alert.KeepFiringFor)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()
			r.GrafanaManagedAlert.UID = ""
			lim := limits
			if testCase.limits != nil {
				lim = *testCase.limits
			}

			alert, err := ValidateRuleNode(r, name, interval, orgId, folder.UID, lim)
			require.NoError(t, err)
			testCase.assert(t, r, alert)
		})
	}

	t.Run("accepts empty group name", func(t *testing.T) {
		r := validRule()
		alert, err := ValidateRuleNode(&r, "", interval, orgId, folder.UID, limits)
		require.NoError(t, err)
		require.Equal(t, "", alert.RuleGroup)
	})
}

func TestValidateRuleNodeFailures_NoUID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	cfg := config(t)
	limits := makeLimits(cfg)

	testCases := []struct {
		name           string
		interval       *time.Duration
		rule           func() *apimodels.PostableExtendedRuleNode
		limits         *RuleLimits
		expErr         string
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
		{
			name: "fail if ExecErrState is not known",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.ExecErrState = apimodels.ExecutionErrorState(util.GenerateShortUID())
				return &r
			},
		},
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
				r.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified and Panel ID is NaN",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.Annotations = map[string]string{
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
				r.Annotations = map[string]string{
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
		{
			name: "rejects recording rule with invalid metric name",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Record = &apimodels.Record{Metric: "", From: "A"}
				r.GrafanaManagedAlert.Condition = ""
				r.GrafanaManagedAlert.NoDataState = ""
				r.GrafanaManagedAlert.ExecErrState = ""
				r.GrafanaManagedAlert.NotificationSettings = nil
				r.For = nil
				return &r
			},
			expErr: "must be a valid Prometheus metric name",
		},
		{
			name: "rejects recording rule with empty from",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Record = &apimodels.Record{Metric: "my_metric", From: ""}
				r.GrafanaManagedAlert.Condition = ""
				r.GrafanaManagedAlert.NoDataState = ""
				r.GrafanaManagedAlert.ExecErrState = ""
				r.GrafanaManagedAlert.NotificationSettings = nil
				r.For = nil
				return &r
			},
			expErr: "cannot be empty",
		},
		{
			name: "rejects recording rule with from not matching",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.Record = &apimodels.Record{Metric: "my_metric", From: "NOTEXIST"}
				r.GrafanaManagedAlert.Condition = ""
				r.GrafanaManagedAlert.NoDataState = ""
				r.GrafanaManagedAlert.ExecErrState = ""
				r.GrafanaManagedAlert.NotificationSettings = nil
				r.For = nil
				return &r
			},
			expErr: "NOTEXIST does not exist",
		},
		{
			name: "fail if keep_firing_for is negative",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				keepFiringFor := model.Duration(-1)
				r.KeepFiringFor = &keepFiringFor
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

			lim := limits
			if testCase.limits != nil {
				lim = *testCase.limits
			}

			_, err := ValidateRuleNode(r, "", interval, orgId, folder.UID, lim)
			require.Error(t, err)
			if testCase.expErr != "" {
				require.ErrorContains(t, err, testCase.expErr)
			}
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
	limits := makeLimits(cfg)
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
			name: "use empty Alerting if ExecErrState is empty",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.GrafanaManagedAlert.ExecErrState = ""
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, models.ExecutionErrorState(""), alert.ExecErrState)
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
				r.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
					models.PanelIDAnnotation:      strconv.Itoa(rand.Int()),
				}
				return &r
			},
			assert: func(t *testing.T, api *apimodels.PostableExtendedRuleNode, alert *models.AlertRule) {
				require.Equal(t, api.Annotations[models.DashboardUIDAnnotation], *alert.DashboardUID)
				panelId, err := strconv.Atoi(api.Annotations[models.PanelIDAnnotation])
				require.NoError(t, err)
				require.Equal(t, int64(panelId), *alert.PanelID)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			r := testCase.rule()
			alert, err := ValidateRuleNode(r, name, interval, orgId, folder.UID, limits)
			require.NoError(t, err)
			testCase.assert(t, r, alert)
		})
	}

	t.Run("accepts empty group name", func(t *testing.T) {
		r := validRule()
		alert, err := ValidateRuleNode(&r, "", interval, orgId, folder.UID, limits)
		require.NoError(t, err)
		require.Equal(t, "", alert.RuleGroup)
	})
}

func TestValidateRuleNodeFailures_UID(t *testing.T) {
	orgId := rand.Int63()
	folder := randFolder()
	cfg := config(t)
	limits := makeLimits(cfg)

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
				r.Annotations = map[string]string{
					models.DashboardUIDAnnotation: util.GenerateShortUID(),
				}
				return &r
			},
		},
		{
			name: "fail if Dashboard UID is specified and Panel ID is NaN",
			rule: func() *apimodels.PostableExtendedRuleNode {
				r := validRule()
				r.Annotations = map[string]string{
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
				r.Annotations = map[string]string{
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

			_, err := ValidateRuleNode(r, "", interval, orgId, folder.UID, limits)
			require.Error(t, err)
			if testCase.assert != nil {
				testCase.assert(t, r, err)
			}
		})
	}
}

func TestValidateRuleNodeIntervalFailures(t *testing.T) {
	cfg := config(t)
	limits := makeLimits(cfg)

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
			_, err := ValidateRuleNode(&r, util.GenerateShortUID(), testCase.interval, rand.Int63(), randFolder().UID, limits)
			require.Error(t, err)
		})
	}
}

func TestValidateRuleNodeNotificationSettings(t *testing.T) {
	cfg := config(t)
	limits := makeLimits(cfg)

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
			name:                 "group by missing alert name label is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy(models.FolderTitleLabel)),
		},
		{
			name:                 "group by missing folder name label is valid",
			notificationSettings: models.CopyNotificationSettings(validNotificationSettings(), models.NSMuts.WithGroupBy(model.AlertNameLabel)),
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
			_, err := ValidateRuleNode(&r, util.GenerateShortUID(), cfg.BaseInterval*time.Duration(rand.Int63n(10)+1), rand.Int63(), randFolder().UID, limits)

			if tt.expErrorContains != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.expErrorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestValidateRuleNodeEditorSettings(t *testing.T) {
	cfg := config(t)
	limits := makeLimits(cfg)

	editorSettings := models.EditorSettings{
		SimplifiedQueryAndExpressionsSection: true,
		SimplifiedNotificationsSection:       true,
	}

	testCases := []struct {
		name           string
		editorSettings models.EditorSettings
	}{
		{
			name:           "valid editor settings",
			editorSettings: editorSettings,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			r := validRule()
			r.GrafanaManagedAlert.Metadata = AlertRuleMetadataFromModelMetadata(models.AlertRuleMetadata{EditorSettings: tt.editorSettings})
			newRule, err := ValidateRuleNode(&r, util.GenerateShortUID(), cfg.BaseInterval*time.Duration(rand.Int63n(10)+1), rand.Int63(), randFolder().UID, limits)
			require.NoError(t, err)
			require.Equal(t, tt.editorSettings, newRule.Metadata.EditorSettings)
		})
	}
}

func TestValidateRuleNodeReservedLabels(t *testing.T) {
	cfg := config(t)
	limits := makeLimits(cfg)

	for label := range models.LabelsUserCannotSpecify {
		t.Run(label, func(t *testing.T) {
			r := validRule()
			r.Labels = map[string]string{
				label: "true",
			}
			_, err := ValidateRuleNode(&r, util.GenerateShortUID(), cfg.BaseInterval*time.Duration(rand.Int63n(10)+1), rand.Int63(), randFolder().UID, limits)
			require.Error(t, err)
			require.ErrorContains(t, err, label)
		})
	}
}
