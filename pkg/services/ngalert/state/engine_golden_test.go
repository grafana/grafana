package state_test

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

// The tests in this file pin today's state behaviour with literal values, so a later refactor
// (the engine rule type) can prove it did not change them. The expected values were recorded by running
// the tests on unmodified main. Do not update them to make a refactor pass.

func goldenStateRule() *models.AlertRule {
	return &models.AlertRule{
		ID:        42,
		OrgID:     1,
		Title:     "golden alert",
		Condition: "B",
		Data: []models.AlertQuery{
			{RefID: "A", DatasourceUID: "golden-ds", Model: []byte(`{"refId":"A","expr":"up"}`)},
			{RefID: "B", DatasourceUID: "__expr__", Model: []byte(`{"refId":"B","type":"math","expression":"$A > 0"}`)},
		},
		IntervalSeconds: 60,
		Version:         3,
		UID:             "golden-uid",
		NamespaceUID:    "golden-folder",
		RuleGroup:       "golden-group",
		RuleGroupIndex:  1,
		NoDataState:     models.NoData,
		ExecErrState:    models.ErrorErrState,
		Annotations:     map[string]string{"summary": "golden"},
		Labels:          map[string]string{"severity": "critical"},
	}
}

func TestGoldenCacheIDsAndLabels(t *testing.T) {
	const folderTitle = "Golden Folder"
	evaluatedAt := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	features := featuremgmt.WithFeatures()

	type scenario struct {
		name    string
		mutate  func(r *models.AlertRule)
		results func() eval.Results
		want    map[string][]string
	}
	result := func(s eval.State, labels data.Labels, err error) eval.Result {
		return eval.Result{Instance: labels, State: s, Error: err, EvaluatedAt: evaluatedAt, EvaluationDuration: time.Millisecond}
	}
	scenarios := []scenario{
		{"normal", nil, func() eval.Results {
			return eval.Results{result(eval.Normal, data.Labels{"instance": "a"}, nil)}
		}, goldenNormalStates},
		{"alerting with two label sets", nil, func() eval.Results {
			return eval.Results{
				result(eval.Alerting, data.Labels{"instance": "a"}, nil),
				result(eval.Alerting, data.Labels{"instance": "b", "job": "api"}, nil),
			}
		}, goldenAlertingStates},
	}
	for _, s := range []models.NoDataState{models.NoData, models.Alerting, models.OK} {
		scenarios = append(scenarios, scenario{
			name:   "no data mapped to " + string(s),
			mutate: func(r *models.AlertRule) { r.NoDataState = s },
			results: func() eval.Results {
				return eval.Results{result(eval.NoData, data.Labels{}, nil)}
			},
			want: goldenNoDataAndErrorStates,
		})
	}
	for _, s := range []models.ExecutionErrorState{models.ErrorErrState, models.AlertingErrState, models.OkErrState} {
		scenarios = append(scenarios, scenario{
			name:   "error mapped to " + string(s),
			mutate: func(r *models.AlertRule) { r.ExecErrState = s },
			results: func() eval.Results {
				return eval.Results{result(eval.Error, data.Labels{}, errors.New("golden failure"))}
			},
			want: goldenNoDataAndErrorStates,
		})
	}

	type variant struct {
		name          string
		includeFolder bool
		settings      *models.NotificationSettings
	}
	variants := []variant{
		{"no settings, folder off", false, nil},
		{"no settings, folder on", true, nil},
		{"contact point, folder off", false, &models.NotificationSettings{ContactPointRouting: &models.ContactPointRouting{Receiver: "golden-receiver"}}},
		{"contact point, folder on", true, &models.NotificationSettings{ContactPointRouting: &models.ContactPointRouting{Receiver: "golden-receiver"}}},
		{"policy, folder off", false, &models.NotificationSettings{PolicyRouting: &models.PolicyRouting{Policy: "golden-policy"}}},
		{"policy, folder on", true, &models.NotificationSettings{PolicyRouting: &models.PolicyRouting{Policy: "golden-policy"}}},
	}

	for _, s := range scenarios {
		for _, v := range variants {
			name := s.name + "/" + v.name
			t.Run(name, func(t *testing.T) {
				rule := goldenStateRule()
				if s.mutate != nil {
					s.mutate(rule)
				}
				rule.NotificationSettings = v.settings

				st := state.NewManager(state.ManagerCfg{
					Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
					InstanceStore: &state.FakeInstanceStore{},
					Images:        &state.NoopImageService{},
					Clock:         clock.NewMock(),
					Historian:     &state.FakeHistorian{},
					Tracer:        tracing.InitializeTracerForTest(),
					Log:           log.New("ngalert.state.manager"),
				}, state.NewNoopPersister())

				extra := state.GetRuleExtraLabels(log.NewNopLogger(), rule, folderTitle, v.includeFolder, features)
				transitions, err := st.ProcessEvalResults(context.Background(), evaluatedAt, rule, s.results(), extra, nil)
				require.NoError(t, err)

				got := make([]string, 0, len(transitions))
				for _, tr := range transitions {
					got = append(got, fmt.Sprintf("%s %s", tr.CacheID.String(), tr.Labels.String()))
				}
				slices.Sort(got)
				require.Equal(t, s.want[v.name], got)
			})
		}
	}
}

// Each entry is "<CacheID> <final labels>", keyed by variant name.
var (
	goldenNormalStates = map[string][]string{
		"no settings, folder off":   {"a68b9db26be18d23 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, instance=a, severity=critical"},
		"no settings, folder on":    {"f2de4059862fa78b __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical"},
		"contact point, folder off": {"89b483aa7426eb37 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, instance=a, severity=critical"},
		"contact point, folder on":  {"0348e1d6a88e9527 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical"},
		"policy, folder off":        {"9b17bb452e4ef339 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, instance=a, severity=critical"},
		"policy, folder on":         {"363a154e17de723d __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical"},
	}

	goldenAlertingStates = map[string][]string{
		"no settings, folder off": {
			"13db3fb581fdac89 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, instance=b, job=api, severity=critical",
			"a68b9db26be18d23 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, instance=a, severity=critical",
		},
		"no settings, folder on": {
			"6c3466c72ec1cd61 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, grafana_folder=Golden Folder, instance=b, job=api, severity=critical",
			"f2de4059862fa78b __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical",
		},
		"contact point, folder off": {
			"2d6c3a22fc8f2445 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, instance=b, job=api, severity=critical",
			"89b483aa7426eb37 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, instance=a, severity=critical",
		},
		"contact point, folder on": {
			"0348e1d6a88e9527 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical",
			"e63668acf2c31a15 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, grafana_folder=Golden Folder, instance=b, job=api, severity=critical",
		},
		"policy, folder off": {
			"89f91dc1d15ba7b7 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, instance=b, job=api, severity=critical",
			"9b17bb452e4ef339 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, instance=a, severity=critical",
		},
		"policy, folder on": {
			"363a154e17de723d __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, grafana_folder=Golden Folder, instance=a, severity=critical",
			"f5558a6448c2ba73 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, grafana_folder=Golden Folder, instance=b, job=api, severity=critical",
		},
	}

	// NoData and Error results carry no instance labels. Every NoDataState and ExecErrState mapping lands on
	// the same CacheID and label set; only the resulting state differs, which this test does not pin.
	goldenNoDataAndErrorStates = map[string][]string{
		"no settings, folder off":   {"ddfad240f9842c3d __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, severity=critical"},
		"no settings, folder on":    {"4fe4ba7d8fa1a9a5 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, alertname=golden alert, grafana_folder=Golden Folder, severity=critical"},
		"contact point, folder off": {"c5cb275028cce5d9 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, severity=critical"},
		"contact point, folder on":  {"c423d5f7284d09e9 __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_autogenerated__=true, __grafana_receiver__=golden-receiver, alertname=golden alert, grafana_folder=Golden Folder, severity=critical"},
		"policy, folder off":        {"c897d0194e2749ff __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, severity=critical"},
		"policy, folder on":         {"a9b2bed6a24ae6fb __alert_rule_namespace_uid__=golden-folder, __alert_rule_uid__=golden-uid, __grafana_managed_route__=golden-policy, alertname=golden alert, grafana_folder=Golden Folder, severity=critical"},
	}
)

func TestGoldenRuleMeta(t *testing.T) {
	cases := []struct {
		name string
		rule func() *models.AlertRule
		want model.RuleMeta
	}{
		{"alerting rule", goldenStateRule, model.RuleMeta{
			ID: 42, OrgID: 1, UID: "golden-uid", Title: "golden alert", Group: "golden-group",
			NamespaceUID: "golden-folder", Condition: "B",
		}},
		{"alerting rule with dashboard annotations", func() *models.AlertRule {
			r := goldenStateRule()
			r.Annotations = map[string]string{models.DashboardUIDAnnotation: "golden-dashboard", models.PanelIDAnnotation: "7"}
			return r
		}, model.RuleMeta{
			ID: 42, OrgID: 1, UID: "golden-uid", Title: "golden alert", Group: "golden-group",
			NamespaceUID: "golden-folder", DashboardUID: "golden-dashboard", PanelID: 7, Condition: "B",
		}},
		{"recording rule", func() *models.AlertRule {
			r := goldenStateRule()
			r.UID = "golden-recording-uid"
			r.Title = "golden recording"
			r.Condition = "A"
			r.Record = &models.Record{Metric: "golden_metric", From: "A", TargetDatasourceUID: "golden-target-ds"}
			return r
		}, model.RuleMeta{
			ID: 42, OrgID: 1, UID: "golden-recording-uid", Title: "golden recording", Group: "golden-group",
			NamespaceUID: "golden-folder", Condition: "A",
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, model.NewRuleMeta(c.rule(), log.NewNopLogger()))
		})
	}
}
