package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/url"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	annotation_ac "github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	historymodel "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/weaveworks/common/http/client"

	"github.com/stretchr/testify/require"
)

func TestIntegrationAlertStateHistoryStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql := db.InitTestDB(t)

	t.Cleanup(func() {
		err := sql.WithDbSession(context.Background(), func(dbSession *db.Session) error {
			_, err := dbSession.Exec("DELETE FROM dashboard WHERE 1=1")
			if err != nil {
				return err
			}
			return err
		})
		require.NoError(t, err)
	})

	dashboard1 := testutil.CreateDashboard(t, sql, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	})

	dashboard2 := testutil.CreateDashboard(t, sql, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 2",
		}),
	})

	t.Run("Testing Loki state history read", func(t *testing.T) {
		knownUIDs := &sync.Map{}

		dashAlert1 := createAlertRuleWithDashboard(
			t,
			sql,
			knownUIDs,
			"Test Rule 1",
			dashboard1.UID,
		)

		dashAlert2 := createAlertRuleWithDashboard(
			t,
			sql,
			knownUIDs,
			"Test Rule 2",
			dashboard1.UID,
		)

		dashAlert3 := createAlertRuleWithDashboard(
			t,
			sql,
			knownUIDs,
			"Test Rule 3",
			dashboard2.UID,
		)

		orgAlert1 := createAlertRule(
			t,
			sql,
			knownUIDs,
			"Test Rule 4",
		)

		start := time.Now()
		numTransitions := 2
		transitions := genStateTransitions(t, numTransitions, start)

		fakeLokiClient := NewFakeLokiClient()
		store := createTestLokiStore(t, sql, fakeLokiClient)

		t.Run("can query history by alert id", func(t *testing.T) {
			fakeLokiClient.Response = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert1), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:   1,
				AlertID: dashAlert1.ID,
				From:    start.Unix(),
				To:      start.Add(time.Second * time.Duration(numTransitions)).Unix(),
			}
			res, err := store.Get(
				context.Background(),
				&query,
				annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					ScopeTypes: map[any]struct{}{
						testutil.DashScopeType: {},
					},
				},
			)
			require.NoError(t, err)
			require.Len(t, res, numTransitions)
		})

		t.Run("can query history by dashboard id", func(t *testing.T) {
			fakeLokiClient.Response = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert1), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert2), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.Unix(),
				To:          start.Add(time.Second * time.Duration(numTransitions)).Unix(),
			}
			res, err := store.Get(
				context.Background(),
				&query,
				annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					ScopeTypes: map[any]struct{}{
						testutil.DashScopeType: {},
					},
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 2*numTransitions)
		})

		t.Run("should only include history from dashboards in scope", func(t *testing.T) {
			fakeLokiClient.Response = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert1), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert2), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert3), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID: 1,
				From:  start.Unix(),
				To:    start.Add(time.Second * time.Duration(numTransitions)).Unix(),
			}
			res, err := store.Get(
				context.Background(),
				&query,
				annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard2.UID: dashboard2.ID,
					},
					ScopeTypes: map[any]struct{}{
						testutil.DashScopeType: {},
					},
				},
			)
			require.NoError(t, err)
			require.Len(t, res, numTransitions)
		})

		t.Run("should only include history without linked dashboard on org scope", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID: 1,
				From:  start.Unix(),
				To:    start.Add(time.Second * time.Duration(numTransitions)).Unix(),
			}

			fakeLokiClient.Response = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert1), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert2), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashAlert3), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, orgAlert1), transitions, map[string]string{}, log.NewNopLogger()),
			}

			res, err := store.Get(
				context.Background(),
				&query,
				annotation_ac.AccessResources{
					Dashboards: map[string]int64{},
					ScopeTypes: map[any]struct{}{
						testutil.OrgScopeType: {},
					},
				},
			)
			require.NoError(t, err)
			require.Len(t, res, numTransitions)
		})

		t.Run("should not find any when item is outside time range", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.Add(-2 * time.Second).Unix(),
				To:          start.Add(-1 * time.Second).Unix(),
			}
			res, err := store.Get(
				context.Background(),
				&query,
				annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					ScopeTypes: map[any]struct{}{
						testutil.DashScopeType: {},
					},
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 0)
		})
	})

	t.Run("Testing get alert rule", func(t *testing.T) {
		store := createTestLokiStore(t, sql, NewFakeLokiClient())
		rule := createAlertRuleWithDashboard(t, sql, nil, "Alert Rule", "dashboardUID")

		t.Run("should get rule by UID", func(t *testing.T) {
			query := ruleQuery{
				OrgID: 1,
				UID:   rule.UID,
			}

			dbRule, err := store.getRule(context.Background(), query)
			require.NoError(t, err)
			require.Equal(t, rule.ID, dbRule.ID)
			require.Equal(t, rule.UID, dbRule.UID)
		})

		t.Run("should get rule by ID", func(t *testing.T) {
			query := ruleQuery{
				OrgID: 1,
				ID:    rule.ID,
			}

			dbRule, err := store.getRule(context.Background(), query)
			require.NoError(t, err)
			require.Equal(t, rule.ID, dbRule.ID)
			require.Equal(t, rule.UID, dbRule.UID)
		})
	})

	t.Run("Testing items from Loki stream", func(t *testing.T) {
		fakeLokiClient := NewFakeLokiClient()
		store := createTestLokiStore(t, sql, fakeLokiClient)

		t.Run("should return empty list when no streams", func(t *testing.T) {
			items := store.itemsFromStreams(context.Background(), 1, []historian.Stream{}, annotation_ac.AccessResources{})
			require.Empty(t, items)
		})

		t.Run("should return empty list when no entries", func(t *testing.T) {
			items := store.itemsFromStreams(context.Background(), 1, []historian.Stream{
				{
					Values: []historian.Sample{},
				},
			}, annotation_ac.AccessResources{})
			require.Empty(t, items)
		})

		t.Run("should return one annotation per stream+sample", func(t *testing.T) {
			alert := createAlertRuleWithDashboard(t, sql, nil, "Test Rule", dashboard1.UID)

			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			res := []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, alert), transitions, map[string]string{}, log.NewNopLogger()),
			}

			items := store.itemsFromStreams(context.Background(), 1, res, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				ScopeTypes: map[any]struct{}{
					testutil.DashScopeType: {},
				},
			})
			require.Len(t, items, numTransitions)

			for i := 0; i < numTransitions; i++ {
				item := items[i]
				transition := transitions[i]

				expected := &annotations.ItemDTO{
					AlertID:      alert.ID,
					AlertName:    alert.Title,
					DashboardID:  dashboard1.ID,
					DashboardUID: &dashboard1.UID,
					PanelID:      *alert.PanelID,
					Time:         transition.State.LastEvaluationTime.UnixMilli(),
					NewState:     transition.Formatted(),
				}
				if i > 0 {
					prevTransition := transitions[i-1]
					expected.PrevState = prevTransition.Formatted()
				}

				compareAnnotationItem(t, expected, item)
			}
		})
		t.Run("should filter out history from dashboards not in scope", func(t *testing.T) {
			alert1 := createAlertRuleWithDashboard(t, sql, nil, "Test Rule 1", dashboard1.UID)
			alert2 := createAlertRuleWithDashboard(t, sql, nil, "Test Rule 2", dashboard2.UID)

			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			res := []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, alert1), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, alert2), transitions, map[string]string{}, log.NewNopLogger()),
			}

			items := store.itemsFromStreams(context.Background(), 1, res, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				ScopeTypes: map[any]struct{}{
					testutil.DashScopeType: {},
				},
			})
			require.Len(t, items, numTransitions)

			for i := 0; i < numTransitions; i++ {
				item := items[i]
				transition := transitions[i]

				expected := &annotations.ItemDTO{
					AlertID:      alert1.ID,
					AlertName:    alert1.Title,
					DashboardID:  dashboard1.ID,
					DashboardUID: &dashboard1.UID,
					PanelID:      *alert1.PanelID,
					Time:         transition.State.LastEvaluationTime.UnixMilli(),
					NewState:     transition.Formatted(),
				}
				if i > 0 {
					prevTransition := transitions[i-1]
					expected.PrevState = prevTransition.Formatted()
				}

				compareAnnotationItem(t, expected, item)
			}
		})

		t.Run("should include only history without linked dashboard on org scope", func(t *testing.T) {
			knownUIDs := &sync.Map{}

			alert1 := createAlertRuleWithDashboard(t, sql, knownUIDs, "Test Rule 1", dashboard1.UID)

			alert2 := createAlertRule(t, sql, knownUIDs, "Test Rule 2")

			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			res := []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, alert1), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, alert2), transitions, map[string]string{}, log.NewNopLogger()),
			}

			items := store.itemsFromStreams(context.Background(), 1, res, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				ScopeTypes: map[any]struct{}{
					testutil.OrgScopeType: {},
				},
			})
			require.Len(t, items, numTransitions)

			for i := 0; i < numTransitions; i++ {
				item := items[i]
				transition := transitions[i]

				expected := &annotations.ItemDTO{
					AlertID:   alert2.ID,
					AlertName: alert2.Title,
					Time:      transition.State.LastEvaluationTime.UnixMilli(),
					NewState:  transition.Formatted(),
				}
				if i > 0 {
					prevTransition := transitions[i-1]
					expected.PrevState = prevTransition.Formatted()
				}

				compareAnnotationItem(t, expected, item)
			}
		})
	})
}

func TestShouldReplay(t *testing.T) {
	entry := historian.LokiEntry{
		DashboardUID: "dashboard-uid",
	}
	transition := &state.StateTransition{
		PreviousState: eval.Normal,
		State: &state.State{
			State: eval.Alerting,
		},
	}

	t.Run("should return false when transition should not be recorded", func(t *testing.T) {
		transition := &state.StateTransition{
			PreviousState: eval.Normal,
			State: &state.State{
				State: eval.Normal,
			},
		}
		require.False(t, shouldReplay(entry, transition, annotation_ac.AccessResources{}))
	})

	t.Run("should return false when scope is organization and entry has dashboard UID", func(t *testing.T) {
		require.False(t, shouldReplay(entry, transition, annotation_ac.AccessResources{
			ScopeTypes: map[interface{}]struct{}{
				testutil.OrgScopeType: {},
			},
		}))
	})

	t.Run("should return false when scope is dashboard and dashboard UID is not in resources", func(t *testing.T) {
		require.False(t, shouldReplay(entry, transition, annotation_ac.AccessResources{
			ScopeTypes: map[interface{}]struct{}{
				testutil.DashScopeType: {},
			},
			Dashboards: map[string]int64{
				"other-dashboard-uid": 1,
			},
		}))
	})

	t.Run("should return true when scope is dashboard and dashboard UID is in resources", func(t *testing.T) {
		require.True(t, shouldReplay(entry, transition, annotation_ac.AccessResources{
			ScopeTypes: map[interface{}]struct{}{
				testutil.DashScopeType: {},
			},
			Dashboards: map[string]int64{
				"dashboard-uid": 1,
			},
		}))
	})
}

func TestFloat64Map(t *testing.T) {
	t.Run(`should convert json string:float kv to Golang map[string]float64`, func(t *testing.T) {
		jsonMap := simplejson.NewFromAny(map[string]any{
			"key1": json.Number("1.0"),
			"key2": json.Number("2.0"),
		})

		golangMap, err := float64Map(jsonMap)
		require.NoError(t, err)

		require.Equal(t, map[string]float64{
			"key1": 1.0,
			"key2": 2.0,
		}, golangMap)
	})

	t.Run("should return error when json map contains non-float values", func(t *testing.T) {
		jsonMap := simplejson.NewFromAny(map[string]any{
			"key1": json.Number("1.0"),
			"key2": "not a float",
		})

		_, err := float64Map(jsonMap)
		require.Error(t, err)
	})
}

func TestParseFormattedState(t *testing.T) {
	t.Run("should parse formatted state", func(t *testing.T) {
		stateStr := "Normal (MissingSeries)"
		s, reason, err := parseFormattedState(stateStr)
		require.NoError(t, err)

		require.Equal(t, eval.Normal, s)
		require.Equal(t, ngmodels.StateReasonMissingSeries, reason)
	})

	t.Run("should return error when formatted state is invalid", func(t *testing.T) {
		stateStr := "NotAState"
		_, _, err := parseFormattedState(stateStr)
		require.Error(t, err)
	})
}

func TestBuildTransitionStub(t *testing.T) {
	t.Run("should build stub correctly", func(t *testing.T) {
		now := time.Now()

		values := map[string]float64{
			"key1": 1.0,
			"key2": 2.0,
		}
		labels := map[string]string{
			"key1": "value1",
			"key2": "value2",
		}

		expected := &state.StateTransition{
			PreviousState:       eval.Error,
			PreviousStateReason: ngmodels.StateReasonNoData,
			State: &state.State{
				LastEvaluationTime: now,
				State:              eval.Normal,
				Values:             values,
				Labels:             labels,
			},
		}

		jsonValues := simplejson.New()
		for k, v := range values {
			jsonValues.Set(k, json.Number(strconv.FormatFloat(v, 'f', -1, 64)))
		}

		stub, err := buildTransitionStub(
			&historian.LokiEntry{
				Current:        "Normal",
				Previous:       "Error (NoData)",
				Values:         jsonValues,
				InstanceLabels: labels,
			},
			now,
		)

		require.NoError(t, err)
		require.Equal(t, expected, stub)
	})

	t.Run("fails when passed map with non-float values", func(t *testing.T) {
		_, err := buildTransitionStub(
			&historian.LokiEntry{
				Current:  "Normal",
				Previous: "Error (NoData)",
				Values:   simplejson.NewFromAny(map[string]any{"key1": "not a float"}),
				InstanceLabels: map[string]string{
					"key1": "value1",
					"key2": "value2",
				},
			},
			time.Now(),
		)

		require.Error(t, err)
	})
}

func TestBuildAnnotationItem(t *testing.T) {
	values := map[string]float64{
		"key1": 1.0,
		"key2": 2.0,
	}

	entry := &historian.LokiEntry{
		Current:      "Normal",
		Previous:     "Error (NoData)",
		DashboardUID: "dashboardUID",
		PanelID:      123,
	}

	dashID := int64(123)
	rule := &ngmodels.AlertRule{
		ID:    456,
		Title: "Test Rule",
	}
	s := &state.State{
		State:              eval.Normal,
		LastEvaluationTime: time.Now(),
		Values:             values,
		Labels: map[string]string{
			"key1": "value1",
			"key2": "value2",
		},
	}

	item, err := buildAnnotationItem(entry, dashID, rule, s)
	require.NoError(t, err)

	expectedText := fmt.Sprintf("Test Rule {key1=value1, key2=value2} - key1=%f, key2=%f", values["key1"], values["key2"])
	expectedData := simplejson.NewFromAny(map[string]any{
		"values": simplejson.NewFromAny(map[string]any{
			"key1": 1.0,
			"key2": 2.0,
		}),
	})

	require.Equal(t, &annotations.ItemDTO{
		AlertID:      rule.ID,
		AlertName:    rule.Title,
		DashboardID:  dashID,
		DashboardUID: &entry.DashboardUID,
		PanelID:      entry.PanelID,
		NewState:     entry.Current,
		PrevState:    entry.Previous,
		Time:         s.LastEvaluationTime.UnixMilli(),
		Text:         expectedText,
		Data:         expectedData,
	}, item)
}

func createTestLokiStore(t *testing.T, sql db.DB, client lokiQueryClient) *AlertStateHistoryStore {
	t.Helper()

	return &AlertStateHistoryStore{
		client: client,
		db:     sql,
		log:    log.NewNopLogger(),
	}
}

func createAlertRule(t *testing.T, sql db.DB, knownUIDs *sync.Map, title string) *ngmodels.AlertRule {
	t.Helper()

	if knownUIDs == nil {
		knownUIDs = &sync.Map{}
	}

	generator := ngmodels.AlertRuleGen(
		ngmodels.WithTitle(title),
		ngmodels.WithUniqueUID(knownUIDs),
		withDashboardUID(""), // no dashboard
		ngmodels.WithUniqueID(),
		ngmodels.WithOrgID(1),
	)

	rule := generator()

	err := sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Table(ngmodels.AlertRule{}).InsertOne(rule)
		if err != nil {
			return err
		}

		dbRule := &ngmodels.AlertRule{}
		exist, err := sess.Table(ngmodels.AlertRule{}).ID(rule.ID).Get(dbRule)
		if err != nil {
			return err
		}
		if !exist {
			return errors.New("cannot read inserted record")
		}
		rule = dbRule

		return nil
	})
	require.NoError(t, err)

	return rule
}

func createAlertRuleWithDashboard(t *testing.T, sql db.DB, knownUIDs *sync.Map, title string, dashboardUID string) *ngmodels.AlertRule {
	t.Helper()

	if knownUIDs == nil {
		knownUIDs = &sync.Map{}
	}

	generator := ngmodels.AlertRuleGen(
		ngmodels.WithTitle(title),
		ngmodels.WithUniqueUID(knownUIDs),
		ngmodels.WithUniqueID(),
		ngmodels.WithOrgID(1),
		withDashboardUID(dashboardUID),
		withPanelID(123),
	)

	rule := generator()

	err := sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Table(ngmodels.AlertRule{}).InsertOne(rule)
		if err != nil {
			return err
		}

		dbRule := &ngmodels.AlertRule{}
		exist, err := sess.Table(ngmodels.AlertRule{}).ID(rule.ID).Get(dbRule)
		if err != nil {
			return err
		}
		if !exist {
			return errors.New("cannot read inserted record")
		}
		rule = dbRule

		return nil
	})
	require.NoError(t, err)

	return rule
}

func ruleMetaFromRule(t *testing.T, rule *ngmodels.AlertRule) historymodel.RuleMeta {
	t.Helper()

	meta := historymodel.RuleMeta{
		OrgID: rule.OrgID,
		UID:   rule.UID,
		ID:    rule.ID,
	}

	if rule.DashboardUID != nil {
		meta.DashboardUID = *rule.DashboardUID
	}

	if rule.PanelID != nil {
		meta.PanelID = *rule.PanelID
	}

	return meta
}

func genStateTransitions(t *testing.T, num int, start time.Time) []state.StateTransition {
	t.Helper()

	transitions := make([]state.StateTransition, 0, num)
	lastState := state.State{
		State:              eval.Normal,
		StateReason:        "",
		LastEvaluationTime: start,
		Values: map[string]float64{
			"key1": 1.0,
			"key2": 2.0,
		},
		Labels: map[string]string{
			"key1": "value1",
			"key2": "value2",
		},
	}

	for i := 0; i < num; i++ {
		stateVal := rand.Intn(4)
		if stateVal == int(lastState.State) {
			stateVal = (stateVal + 1) % 4
		}

		newState := state.State{
			State:              eval.State(stateVal),
			StateReason:        "",
			LastEvaluationTime: lastState.LastEvaluationTime.Add(time.Second * time.Duration(i)),
			Values:             lastState.Values,
			Labels:             lastState.Labels,
		}

		transitions = append(transitions, state.StateTransition{
			PreviousState:       lastState.State,
			PreviousStateReason: lastState.StateReason,
			State:               &newState,
		})

		lastState = newState
	}

	return transitions
}

func withDashboardUID(dashboardUID string) ngmodels.AlertRuleMutator {
	return func(rule *ngmodels.AlertRule) {
		rule.DashboardUID = &dashboardUID
	}
}

func withPanelID(panelID int64) ngmodels.AlertRuleMutator {
	return func(rule *ngmodels.AlertRule) {
		rule.PanelID = &panelID
	}
}

func compareAnnotationItem(t *testing.T, expected, actual *annotations.ItemDTO) {
	t.Helper()

	require.Equal(t, expected.AlertID, actual.AlertID)
	require.Equal(t, expected.AlertName, actual.AlertName)
	if expected.PanelID != 0 {
		require.Equal(t, expected.PanelID, actual.PanelID)
	}
	if expected.DashboardUID != nil {
		require.Equal(t, expected.DashboardID, actual.DashboardID)
		require.Equal(t, *expected.DashboardUID, *actual.DashboardUID)
	}
	require.Equal(t, expected.NewState, actual.NewState)
	if expected.PrevState != "" {
		require.Equal(t, expected.PrevState, actual.PrevState)
	}
	require.Equal(t, expected.Time, actual.Time)
	if expected.Text != "" && expected.Data != nil {
		require.Equal(t, expected.Text, actual.Text)
		require.Equal(t, expected.Data, actual.Data)
	}
}

type FakeLokiClient struct {
	client   client.Requester
	cfg      historian.LokiConfig
	metrics  *metrics.Historian
	log      log.Logger
	Response []historian.Stream
}

func NewFakeLokiClient() *FakeLokiClient {
	url, _ := url.Parse("http://some.url")
	req := historian.NewFakeRequester()
	metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry())

	return &FakeLokiClient{
		client: client.NewTimedClient(req, metrics.WriteDuration),
		cfg: historian.LokiConfig{
			WritePathURL: url,
			ReadPathURL:  url,
			Encoder:      historian.JsonEncoder{},
		},
		metrics: metrics,
		log:     log.New("ngalert.state.historian", "backend", "loki"),
	}
}

func (c *FakeLokiClient) RangeQuery(_ context.Context, _ string, _, _, _ int64) (historian.QueryRes, error) {
	res := historian.QueryRes{
		Data: historian.QueryData{
			Result: c.Response,
		},
	}
	// reset expected streams on read
	c.Response = []historian.Stream{}
	return res, nil
}
