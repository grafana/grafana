package loki

import (
	"context"
	"encoding/json"
	"math/rand"
	"net/url"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	annotation_ac "github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	historymodel "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAlertStateHistoryStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql, cfg := db.InitTestDBWithCfg(t)

	dashboard1 := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 1",
		}),
	})

	dashboard2 := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "Dashboard 2",
		}),
	})
	gen := ngmodels.RuleGen.With(ngmodels.RuleGen.WithOrgID(1))

	dashboardRules := map[string][]*ngmodels.AlertRule{
		dashboard1.UID: {
			createAlertRuleFromDashboard(t, sql, "Test Rule 1", *dashboard1, gen),
			createAlertRuleFromDashboard(t, sql, "Test Rule 2", *dashboard1, gen),
		},
		dashboard2.UID: {
			createAlertRuleFromDashboard(t, sql, "Test Rule 3", *dashboard2, gen),
		},
	}

	t.Run("Testing Loki state history read", func(t *testing.T) {
		start := time.Now()
		numTransitions := 2
		transitions := genStateTransitions(t, numTransitions, start)

		fakeLokiClient := NewFakeLokiClient()
		store := createTestLokiStore(t, sql, fakeLokiClient)

		t.Run("can query history by alert id", func(t *testing.T) {
			rule := dashboardRules[dashboard1.UID][0]

			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:   1,
				AlertID: rule.ID,
				From:    start.UnixMilli(),
				To:      start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, numTransitions)
		})

		t.Run("can query history by alert uid", func(t *testing.T) {
			rule := dashboardRules[dashboard1.UID][0]

			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:    1,
				AlertUID: rule.UID,
				From:     start.UnixMilli(),
				To:       start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, numTransitions)
		})

		t.Run("should return ErrLokiStoreNotFound if rule is not found by ID", func(t *testing.T) {
			var rules = slices.Concat(maps.Values(dashboardRules)...)
			id := rand.Int63n(1000) // in Postgres ID is integer, so limit range
			// make sure id is not known
			for slices.IndexFunc(rules, func(rule *ngmodels.AlertRule) bool {
				return rule.ID == id
			}) >= 0 {
				id = rand.Int63n(1000)
			}

			query := annotations.ItemQuery{
				OrgID:   1,
				AlertID: id,
				From:    start.UnixMilli(),
				To:      start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			_, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.ErrorIs(t, err, ErrLokiStoreNotFound)
		})

		t.Run("should return empty response if rule is not found by UID", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:    1,
				AlertUID: "not-found-uid",
				From:     start.UnixMilli(),
				To:       start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Empty(t, res)
		})

		t.Run("can query history by dashboard id", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.UnixMilli(),
				To:          start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 2*numTransitions)
		})

		t.Run("should return empty results when type is annotation", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID: 1,
				Type:  "annotation",
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Empty(t, res)
		})

		t.Run("should return empty results when history is outside time range", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.Add(-2 * time.Second).UnixMilli(),
				To:          start.Add(-1 * time.Second).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 0)
		})

		t.Run("should return partial results when history is partly outside clamped time range", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			// clamp time range to 1 second
			oldMax := fakeLokiClient.cfg.MaxQueryLength
			fakeLokiClient.cfg.MaxQueryLength = 1 * time.Second

			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.Add(-1 * time.Second).UnixMilli(), // should clamp to start
				To:          start.Add(1 * time.Second).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 2)

			// restore original max query length
			fakeLokiClient.cfg.MaxQueryLength = oldMax
		})

		t.Run("should sort history by time", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID:       1,
				DashboardID: dashboard1.ID,
				From:        start.UnixMilli(),
				To:          start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Len(t, res, 2*numTransitions)

			var lastTime int64
			for _, item := range res {
				if lastTime != 0 {
					require.True(t, item.Time <= lastTime)
				}
				lastTime = item.Time
			}
		})

		t.Run("should return nothing if query is for tags only", func(t *testing.T) {
			fakeLokiClient.rangeQueryRes = []historian.Stream{
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][0]), transitions, map[string]string{}, log.NewNopLogger()),
				historian.StatesToStream(ruleMetaFromRule(t, dashboardRules[dashboard1.UID][1]), transitions, map[string]string{}, log.NewNopLogger()),
			}

			query := annotations.ItemQuery{
				OrgID: 1,
				From:  start.UnixMilli(),
				To:    start.Add(time.Second * time.Duration(numTransitions+1)).UnixMilli(),
				Tags:  []string{"tag1"},
			}
			res, err := store.Get(
				context.Background(),
				query,
				&annotation_ac.AccessResources{
					Dashboards: map[string]int64{
						dashboard1.UID: dashboard1.ID,
					},
					CanAccessDashAnnotations: true,
				},
			)
			require.NoError(t, err)
			require.Empty(t, res)
		})
	})

	t.Run("Testing items from Loki stream", func(t *testing.T) {
		fakeLokiClient := NewFakeLokiClient()
		store := createTestLokiStore(t, sql, fakeLokiClient)

		t.Run("should return empty list when no streams", func(t *testing.T) {
			items := store.annotationsFromStream(historian.Stream{}, annotation_ac.AccessResources{})
			require.Empty(t, items)
		})

		t.Run("should return empty list when no entries", func(t *testing.T) {
			items := store.annotationsFromStream(historian.Stream{
				Values: []historian.Sample{},
			}, annotation_ac.AccessResources{})
			require.Empty(t, items)
		})

		t.Run("should return one annotation per sample", func(t *testing.T) {
			rule := dashboardRules[dashboard1.UID][0]
			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			stream := historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger())

			items := store.annotationsFromStream(stream, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				CanAccessDashAnnotations: true,
			})
			require.Len(t, items, numTransitions)

			for i := 0; i < numTransitions; i++ {
				item := items[i]
				transition := transitions[i]

				expected := &annotations.ItemDTO{
					AlertID:      rule.ID,
					DashboardID:  dashboard1.ID,
					DashboardUID: &dashboard1.UID,
					PanelID:      *rule.PanelID,
					Time:         transition.LastEvaluationTime.UnixMilli(),
					NewState:     transition.Formatted(),
				}
				if i > 0 {
					prevTransition := transitions[i-1]
					expected.PrevState = prevTransition.Formatted()
				}

				compareAnnotationItem(t, expected, item)
			}
		})

		t.Run("should filter out annotations from dashboards not in scope", func(t *testing.T) {
			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			rule := dashboardRules[dashboard1.UID][0]
			stream1 := historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger())

			rule = createAlertRule(t, sql, "Test rule", gen)
			stream2 := historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger())

			stream := historian.Stream{
				Values: append(stream1.Values, stream2.Values...),
				Stream: stream1.Stream,
			}

			items := store.annotationsFromStream(stream, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				CanAccessDashAnnotations: true,
			})
			require.Len(t, items, numTransitions)

			for _, item := range items {
				require.Equal(t, dashboard1.ID, item.DashboardID)
				require.Equal(t, dashboard1.UID, *item.DashboardUID)
			}
		})

		t.Run("should include only annotations without linked dashboard on org scope", func(t *testing.T) {
			start := time.Now()
			numTransitions := 2
			transitions := genStateTransitions(t, numTransitions, start)

			rule := dashboardRules[dashboard1.UID][0]
			stream1 := historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger())

			rule.DashboardUID = nil
			stream2 := historian.StatesToStream(ruleMetaFromRule(t, rule), transitions, map[string]string{}, log.NewNopLogger())

			stream := historian.Stream{
				Values: append(stream1.Values, stream2.Values...),
				Stream: stream1.Stream,
			}

			items := store.annotationsFromStream(stream, annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard1.UID: dashboard1.ID,
				},
				CanAccessOrgAnnotations: true,
			})
			require.Len(t, items, numTransitions)

			for _, item := range items {
				require.Zero(t, *item.DashboardUID)
				require.Zero(t, item.DashboardID)
			}
		})
	})
}

func TestHasAccess(t *testing.T) {
	entry := historian.LokiEntry{
		DashboardUID: "dashboard-uid",
	}

	t.Run("should return false when scope is organization and entry has dashboard UID", func(t *testing.T) {
		require.False(t, hasAccess(entry, annotation_ac.AccessResources{
			CanAccessOrgAnnotations: true,
		}))
	})

	t.Run("should return false when scope is dashboard and dashboard UID is not in resources", func(t *testing.T) {
		require.False(t, hasAccess(entry, annotation_ac.AccessResources{
			CanAccessDashAnnotations: true,
			Dashboards: map[string]int64{
				"other-dashboard-uid": 1,
			},
		}))
	})

	t.Run("should return true when scope is organization and entry has no dashboard UID", func(t *testing.T) {
		require.True(t, hasAccess(historian.LokiEntry{}, annotation_ac.AccessResources{
			CanAccessOrgAnnotations: true,
		}))
	})

	t.Run("should return true when scope is dashboard and dashboard UID is in resources", func(t *testing.T) {
		require.True(t, hasAccess(entry, annotation_ac.AccessResources{
			CanAccessDashAnnotations: true,
			Dashboards: map[string]int64{
				"dashboard-uid": 1,
			},
		}))
	})
}

func TestNumericMap(t *testing.T) {
	t.Run("should return error for nil value", func(t *testing.T) {
		var jsonMap *simplejson.Json
		_, err := numericMap[float64](jsonMap)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unexpected nil value")
	})

	t.Run("should return error for nil interface value", func(t *testing.T) {
		jsonMap := simplejson.NewFromAny(map[string]any{
			"key1": nil,
		})
		_, err := numericMap[float64](jsonMap)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unexpected value type")
	})

	t.Run(`should convert json string:float kv to Golang map[string]float64`, func(t *testing.T) {
		jsonMap := simplejson.NewFromAny(map[string]any{
			"key1": json.Number("1.0"),
			"key2": json.Number("2.0"),
		})

		golangMap, err := numericMap[float64](jsonMap)
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

		_, err := numericMap[float64](jsonMap)
		require.Error(t, err)
	})
}

func TestBuildHistoryQuery(t *testing.T) {
	t.Run("should set dashboard UID from dashboard ID if query does not contain UID", func(t *testing.T) {
		query := buildHistoryQuery(
			&annotations.ItemQuery{
				DashboardID: 1,
			},
			map[string]int64{
				"dashboard-uid": 1,
			},
			"rule-uid",
		)
		require.Equal(t, "dashboard-uid", query.DashboardUID)
	})

	t.Run("should skip dashboard UID if missing from query and dashboard map", func(t *testing.T) {
		query := buildHistoryQuery(
			&annotations.ItemQuery{
				DashboardID: 1,
			},
			map[string]int64{
				"other-dashboard-uid": 2,
			},
			"rule-uid",
		)
		require.Zero(t, query.DashboardUID)
	})

	t.Run("should skip dashboard UID when not in query", func(t *testing.T) {
		query := buildHistoryQuery(
			&annotations.ItemQuery{},
			map[string]int64{
				"dashboard-uid": 1,
			},
			"rule-uid",
		)
		require.Zero(t, query.DashboardUID)
	})
}

func TestBuildTransition(t *testing.T) {
	t.Run("should return error when entry contains invalid state strings", func(t *testing.T) {
		_, err := buildTransition(historian.LokiEntry{
			Current: "Invalid",
		})
		require.Error(t, err)

		_, err = buildTransition(historian.LokiEntry{
			Current:  "Normal",
			Previous: "Invalid",
		})
		require.Error(t, err)
	})

	t.Run("should return error when values are not numbers", func(t *testing.T) {
		_, err := buildTransition(historian.LokiEntry{
			Current: "Normal",
			Values:  simplejson.NewFromAny(map[string]any{"key1": "not a float"}),
		})
		require.Error(t, err)
	})

	t.Run("should build transition correctly", func(t *testing.T) {
		values := map[string]float64{
			"key1": 1.0,
			"key2": 2.0,
		}

		labels := map[string]string{
			"key1": "value1",
			"key2": "value2",
		}

		jsonValues := simplejson.New()
		for k, v := range values {
			jsonValues.Set(k, json.Number(strconv.FormatFloat(v, 'f', -1, 64)))
		}

		entry := historian.LokiEntry{
			Current:        "Normal",
			Previous:       "Error (NoData)",
			Values:         jsonValues,
			InstanceLabels: labels,
		}

		expected := &state.StateTransition{
			State: &state.State{
				State:              eval.Normal,
				StateReason:        "",
				LastEvaluationTime: time.Time{},
				Values:             values,
				Labels:             labels,
			},
			PreviousState:       eval.Error,
			PreviousStateReason: eval.NoData.String(),
		}

		stub, err := buildTransition(entry)

		require.NoError(t, err)
		require.Equal(t, expected, stub)
	})
}

func createTestLokiStore(t *testing.T, sql *sqlstore.SQLStore, client lokiQueryClient) *LokiHistorianStore {
	t.Helper()
	ruleStore := store.SetupStoreForTesting(t, sql)

	return &LokiHistorianStore{
		client:    client,
		db:        sql,
		log:       log.NewNopLogger(),
		ruleStore: ruleStore,
	}
}

// createAlertRule creates an alert rule in the database and returns it.
// If a generator is not specified, uniqueness of primary key is not guaranteed.
func createAlertRule(t *testing.T, sql *sqlstore.SQLStore, title string, generator *ngmodels.AlertRuleGenerator) *ngmodels.AlertRule {
	t.Helper()

	if generator == nil {
		g := ngmodels.RuleGen
		generator = g.With(g.WithTitle(title), g.WithDashboardAndPanel(nil, nil), g.WithOrgID(1))
	}

	rule := generator.Generate()
	// ensure rule has correct values
	if rule.Title != title {
		rule.Title = title
	}
	// rule should not have linked dashboard or panel
	rule.DashboardUID = nil
	rule.PanelID = nil

	ruleStore := store.SetupStoreForTesting(t, sql)
	ids, err := ruleStore.InsertAlertRules(context.Background(), nil, []ngmodels.AlertRule{rule})
	require.NoError(t, err)
	result, err := ruleStore.GetAlertRuleByUID(context.Background(), &ngmodels.GetAlertRuleByUIDQuery{OrgID: rule.OrgID, UID: ids[0].UID})
	require.NoError(t, err)
	return result
}

// createAlertRuleFromDashboard creates an alert rule with a linked dashboard and panel in the database and returns it.
// If a generator is not specified, uniqueness of primary key is not guaranteed.
func createAlertRuleFromDashboard(t *testing.T, sql *sqlstore.SQLStore, title string, dashboard dashboards.Dashboard, generator *ngmodels.AlertRuleGenerator) *ngmodels.AlertRule {
	t.Helper()

	panelID := new(int64)
	*panelID = 123

	if generator == nil {
		g := ngmodels.RuleGen
		generator = g.With(g.WithTitle(title), g.WithDashboardAndPanel(&dashboard.UID, panelID), g.WithOrgID(1))
	}

	rule := generator.Generate()
	// ensure rule has correct values
	if rule.Title != title {
		rule.Title = title
	}
	if rule.DashboardUID == nil || (rule.DashboardUID != nil && *rule.DashboardUID != dashboard.UID) {
		rule.DashboardUID = &dashboard.UID
	}
	if rule.PanelID == nil || (rule.PanelID != nil && *rule.PanelID != *panelID) {
		rule.PanelID = panelID
	}
	ruleStore := store.SetupStoreForTesting(t, sql)
	ids, err := ruleStore.InsertAlertRules(context.Background(), nil, []ngmodels.AlertRule{rule})
	require.NoError(t, err)
	result, err := ruleStore.GetAlertRuleByUID(context.Background(), &ngmodels.GetAlertRuleByUIDQuery{OrgID: rule.OrgID, UID: ids[0].UID})
	require.NoError(t, err)
	return result
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

func compareAnnotationItem(t *testing.T, expected, actual *annotations.ItemDTO) {
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
	client        client.Requester
	cfg           historian.LokiConfig
	metrics       *metrics.Historian
	log           log.Logger
	rangeQueryRes []historian.Stream
}

func NewFakeLokiClient() *FakeLokiClient {
	url, _ := url.Parse("http://some.url")
	req := historian.NewFakeRequester()
	metrics := metrics.NewHistorianMetrics(prometheus.NewRegistry(), "annotations_test")

	return &FakeLokiClient{
		client: client.NewTimedClient(req, metrics.WriteDuration),
		cfg: historian.LokiConfig{
			WritePathURL:   url,
			ReadPathURL:    url,
			Encoder:        historian.JsonEncoder{},
			MaxQueryLength: 721 * time.Hour,
			MaxQuerySize:   65536,
		},
		metrics: metrics,
		log:     log.New("ngalert.state.historian", "backend", "loki"),
	}
}

func (c *FakeLokiClient) RangeQuery(ctx context.Context, query string, from, to, limit int64) (historian.QueryRes, error) {
	streams := make([]historian.Stream, len(c.rangeQueryRes))

	// clamp time range using logic from historian
	from, to = historian.ClampRange(from, to, c.cfg.MaxQueryLength.Nanoseconds())

	for n, stream := range c.rangeQueryRes {
		streams[n].Stream = stream.Stream
		streams[n].Values = []historian.Sample{}
		for _, sample := range stream.Values {
			if sample.T.UnixNano() < from || sample.T.UnixNano() >= to { // matches Loki behavior
				continue
			}
			streams[n].Values = append(streams[n].Values, sample)
		}
	}

	res := historian.QueryRes{
		Data: historian.QueryData{
			Result: streams,
		},
	}

	// reset expected streams on read
	c.rangeQueryRes = []historian.Stream{}
	return res, nil
}

func (c *FakeLokiClient) MaxQuerySize() int {
	return c.cfg.MaxQuerySize
}

func TestUseStore(t *testing.T) {
	t.Run("false if state history disabled", func(t *testing.T) {
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: false,
		}
		use := useStore(cfg)
		require.False(t, use)
	})

	t.Run("false if any invalid backend", func(t *testing.T) {
		t.Run("single", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled: true,
				Backend: "invalid-backend",
			}
			use := useStore(cfg)
			require.False(t, use)
		})

		t.Run("primary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:      true,
				Backend:      "multiple",
				MultiPrimary: "invalid-backend",
			}
			use := useStore(cfg)
			require.False(t, use)
		})

		t.Run("secondary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:          true,
				Backend:          "multiple",
				MultiPrimary:     "annotations",
				MultiSecondaries: []string{"annotations", "invalid-backend"},
			}
			use := useStore(cfg)
			require.False(t, use)
		})
	})

	t.Run("false if no backend is Loki", func(t *testing.T) {
		cfg := setting.UnifiedAlertingStateHistorySettings{
			Enabled: true,
			Backend: "annotations",
		}
		use := useStore(cfg)
		require.False(t, use)
	})

	t.Run("false if Loki is part of multi backend", func(t *testing.T) {
		t.Run("primary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:      true,
				Backend:      "multiple",
				MultiPrimary: "loki",
			}
			use := useStore(cfg)
			require.False(t, use)
		})

		t.Run("secondary", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled:          true,
				Backend:          "multiple",
				MultiPrimary:     "annotations",
				MultiSecondaries: []string{"loki"},
			}
			use := useStore(cfg)
			require.False(t, use)
		})
	})

	t.Run("true if only backend is Loki", func(t *testing.T) {
		t.Run("only", func(t *testing.T) {
			cfg := setting.UnifiedAlertingStateHistorySettings{
				Enabled: true,
				Backend: "loki",
			}
			use := useStore(cfg)
			require.True(t, use)
		})
	})
}
