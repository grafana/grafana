package historian

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiclient"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	rulesAuthz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestRemoteLokiBackend(t *testing.T) {
	t.Run("statesToStream", func(t *testing.T) {
		t.Run("skips non-transitory states", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.Normal})

			res := StatesToStream(rule, states, nil, l)

			require.Empty(t, res.Values)
		})

		t.Run("maps evaluation errors", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.Error, Error: fmt.Errorf("oh no")})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.Contains(t, entry.Error, "oh no")
		})

		t.Run("maps NoData results", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{State: eval.NoData})

			res := StatesToStream(rule, states, nil, l)

			_ = requireSingleEntry(t, res)
		})

		t.Run("produces expected stream identifier", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"a": "b"},
			})

			res := StatesToStream(rule, states, nil, l)

			exp := map[string]string{
				StateHistoryLabelKey: StateHistoryLabelValue,
				"folderUID":          rule.NamespaceUID,
				"group":              rule.Group,
				"orgID":              fmt.Sprint(rule.OrgID),
			}
			require.Equal(t, exp, res.Stream)
		})

		t.Run("excludes private labels", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"__private__": "b"},
			})

			res := StatesToStream(rule, states, nil, l)

			require.NotContains(t, res.Stream, "__private__")
		})

		t.Run("includes rule data in log line", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"a": "b"},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)

			require.Equal(t, rule.Title, entry.RuleTitle)
			require.Equal(t, rule.ID, entry.RuleID)
			require.Equal(t, rule.UID, entry.RuleUID)
		})

		t.Run("includes instance labels in log line", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"statelabel": "labelvalue"},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.Contains(t, entry.InstanceLabels, "statelabel")
		})

		t.Run("does not include labels other than instance labels in log line", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State: eval.Alerting,
				Labels: data.Labels{
					"statelabel": "labelvalue",
					"labeltwo":   "labelvalue",
					"labelthree": "labelvalue",
				},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.Len(t, entry.InstanceLabels, 3)
		})

		t.Run("serializes values when regular", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Values: map[string]float64{"A": 2.0, "B": 5.5},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.NotNil(t, entry.Values)
			require.NotNil(t, entry.Values.Get("A"))
			require.NotNil(t, entry.Values.Get("B"))
			require.InDelta(t, 2.0, entry.Values.Get("A").MustFloat64(), 1e-4)
			require.InDelta(t, 5.5, entry.Values.Get("B").MustFloat64(), 1e-4)
		})

		t.Run("captures condition from rule", func(t *testing.T) {
			rule := createTestRule()
			rule.Condition = "some-condition"
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State:  eval.Alerting,
				Labels: data.Labels{"a": "b"},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			require.Equal(t, rule.Condition, entry.Condition)
		})

		t.Run("stores fingerprint of instance labels", func(t *testing.T) {
			rule := createTestRule()
			l := log.NewNopLogger()
			states := singleFromNormal(&state.State{
				State: eval.Alerting,
				Labels: data.Labels{
					"statelabel": "labelvalue",
					"labeltwo":   "labelvalue",
					"labelthree": "labelvalue",
				},
			})

			res := StatesToStream(rule, states, nil, l)

			entry := requireSingleEntry(t, res)
			exp := labelFingerprint(states[0].Labels)
			require.Equal(t, exp, entry.Fingerprint)
		})
	})
}

func TestBuildLogQuery(t *testing.T) {
	cases := []struct {
		name         string
		query        models.HistoryQuery
		folderUIDs   []string
		maxQuerySize int
		exp          []string
		expErr       error
	}{
		{
			name:  "default includes state history label and orgID label",
			query: models.HistoryQuery{},
			exp:   []string{`{orgID="0",from="state-history"}`},
		},
		{
			name: "adds stream label filter for orgID",
			query: models.HistoryQuery{
				OrgID: 123,
			},
			exp: []string{`{orgID="123",from="state-history"}`},
		},
		{
			name: "filters ruleUID in log line",
			query: models.HistoryQuery{
				OrgID:   123,
				RuleUID: "rule-uid",
			},
			exp: []string{`{orgID="123",from="state-history"} | json | ruleUID="rule-uid"`},
		},
		{
			name: "filters dashboardUID in log line",
			query: models.HistoryQuery{
				OrgID:        123,
				DashboardUID: "dash-uid",
			},
			exp: []string{`{orgID="123",from="state-history"} | json | dashboardUID="dash-uid"`},
		},
		{
			name: "filters panelID in log line",
			query: models.HistoryQuery{
				OrgID:   123,
				PanelID: 456,
			},
			exp: []string{`{orgID="123",from="state-history"} | json | panelID=456`},
		},
		{
			name: "filters instance labels in log line",
			query: models.HistoryQuery{
				OrgID: 123,
				Labels: map[string]string{
					"customlabel": "customvalue",
					"labeltwo":    "labelvaluetwo",
				},
			},
			exp: []string{`{orgID="123",from="state-history"} | json | labels_customlabel="customvalue" | labels_labeltwo="labelvaluetwo"`},
		},
		{
			name: "filters both instance labels + ruleUID",
			query: models.HistoryQuery{
				OrgID:   123,
				RuleUID: "rule-uid",
				Labels: map[string]string{
					"customlabel": "customvalue",
				},
			},
			exp: []string{`{orgID="123",from="state-history"} | json | ruleUID="rule-uid" | labels_customlabel="customvalue"`},
		},
		{
			name: "should return if query does not exceed max limit",
			query: models.HistoryQuery{
				OrgID:   123,
				RuleUID: "rule-uid",
				Labels: map[string]string{
					"customlabel": strings.Repeat("!", 24),
				},
			},
			exp: []string{`{orgID="123",from="state-history"} | json | ruleUID="rule-uid" | labels_customlabel="!!!!!!!!!!!!!!!!!!!!!!!!"`},
		},
		{
			name: "should return error if query is too long",
			query: models.HistoryQuery{
				OrgID:   123,
				RuleUID: "rule-uid",
				Labels: map[string]string{
					"customlabel": strings.Repeat("!", 25),
				},
			},
			expErr: ErrLokiQueryTooLong,
		},
		{
			name: "filters by all namespaces",
			query: models.HistoryQuery{
				OrgID: 123,
			},
			folderUIDs: []string{"folder-1", "folder\\d"},
			exp:        []string{`{orgID="123",from="state-history",folderUID=~` + "`folder-1|folder\\\\d`" + `}`},
		},
		{
			name: "should batch queries to fit all folders",
			query: models.HistoryQuery{
				OrgID: 123,
				Labels: map[string]string{
					"customlabel": "customvalue",
				},
			},
			folderUIDs: []string{"folder-1", "folder-2", "folder\\d", "folder-" + strings.Repeat("!", 13)},
			exp: []string{
				`{orgID="123",from="state-history",folderUID=~` + "`folder-1|folder-2`" + `} | json | labels_customlabel="customvalue"`,
				`{orgID="123",from="state-history",folderUID=~` + "`folder\\\\d`" + `} | json | labels_customlabel="customvalue"`,
				`{orgID="123",from="state-history",folderUID=~` + "`folder-!!!!!!!!!!!!!`" + `} | json | labels_customlabel="customvalue"`,
			},
		},
		{
			name: "should fail if a single folder UID is too long",
			query: models.HistoryQuery{
				OrgID: 123,
				Labels: map[string]string{
					"customlabel": "customvalue",
				},
			},
			folderUIDs: []string{"folder-1", "folder-2", "folder-" + strings.Repeat("!", 14)},
			expErr:     ErrLokiQueryTooLong,
		},
		{
			name: "filters by previous state",
			query: models.HistoryQuery{
				OrgID:    123,
				Previous: "Normal",
			},
			exp: []string{`{orgID="123",from="state-history"} | json | previous=~"^Normal.*"`},
		},
		{
			name: "filters by current state",
			query: models.HistoryQuery{
				OrgID:   123,
				Current: "Alerting",
			},
			exp: []string{`{orgID="123",from="state-history"} | json | current=~"^Alerting.*"`},
		},
		{
			name: "filters by both previous and current state",
			query: models.HistoryQuery{
				OrgID:    123,
				Previous: "Normal",
				Current:  "Alerting",
			},
			exp: []string{`{orgID="123",from="state-history"} | json | previous=~"^Normal.*" | current=~"^Alerting.*"`},
		},
		{
			name: "combines state filters with other filters",
			query: models.HistoryQuery{
				OrgID:    123,
				RuleUID:  "rule-uid",
				Previous: "Pending",
				Current:  "Alerting",
				Labels: map[string]string{
					"instance": "localhost:9090",
				},
			},
			maxQuerySize: 200,
			exp:          []string{`{orgID="123",from="state-history"} | json | ruleUID="rule-uid" | previous=~"^Pending.*" | current=~"^Alerting.*" | labels_instance="localhost:9090"`},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			querySize := tc.maxQuerySize
			if querySize == 0 {
				querySize = 110 // default size
			}
			res, err := BuildLogQuery(tc.query, tc.folderUIDs, querySize)
			if tc.expErr != nil {
				require.ErrorIs(t, err, tc.expErr)
				return
			}
			require.NoError(t, err)
			assert.EqualValues(t, tc.exp, res)
			for i, q := range res {
				assert.LessOrEqualf(t, len(q), querySize, "query at index %d exceeded max query size. Query: %s", i, q)
			}
		})
	}
}

func TestMerge(t *testing.T) {
	testCases := []struct {
		name       string
		res        lokiclient.QueryRes
		expected   *data.Frame
		folderUIDs []string
	}{
		{
			name: "Should return values from multiple streams in right order",
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-1",
								"folderUID": "test-folder-1",
								"extra":     "label",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(1, 0), V: `{"schemaVersion": 1, "previous": "normal", "current": "pending", "values":{"a": 1.5}, "ruleUID": "test-rule-1"}`},
							},
						},
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-2",
								"folderUID": "test-folder-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(2, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "firing", "values":{"a": 2.5}, "ruleUID": "test-rule-2"}`},
							},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{
					time.Unix(1, 0),
					time.Unix(2, 0),
				}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{
					toJson(LokiEntry{RuleUID: "test-rule-1", SchemaVersion: 1, Previous: "normal", Current: "pending", Values: jsonifyValues(map[string]float64{"a": 1.5})}),
					toJson(LokiEntry{RuleUID: "test-rule-2", SchemaVersion: 1, Previous: "pending", Current: "firing", Values: jsonifyValues(map[string]float64{"a": 2.5})}),
				}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-1",
						FolderUIDLabel:       "test-folder-1",
						"extra":              "label",
					}),
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-2",
						FolderUIDLabel:       "test-folder-1",
					}),
				}),
			),
		},
		{
			name: "Should handle empty values",
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"extra": "labels",
							},
							Values: []lokiclient.Sample{},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{}),
			),
		},
		{
			name: "Should handle multiple values in one stream",
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-1",
								"folderUID": "test-folder-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(1, 0), V: `{"schemaVersion": 1, "previous": "normal", "current": "pending", "values":{"a": 1.5}, "ruleUID": "test-rule-1"}`},
								{T: time.Unix(5, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "normal", "values":{"a": 0.5}, "ruleUID": "test-rule-2"}`},
							},
						},
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-2",
								"folderUID": "test-folder-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(2, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "firing", "values":{"a": 2.5}, "ruleUID": "test-rule-3"}`},
							},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{
					time.Unix(1, 0),
					time.Unix(2, 0),
					time.Unix(5, 0),
				}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{
					toJson(LokiEntry{RuleUID: "test-rule-1", SchemaVersion: 1, Previous: "normal", Current: "pending", Values: jsonifyValues(map[string]float64{"a": 1.5})}),
					toJson(LokiEntry{RuleUID: "test-rule-3", SchemaVersion: 1, Previous: "pending", Current: "firing", Values: jsonifyValues(map[string]float64{"a": 2.5})}),
					toJson(LokiEntry{RuleUID: "test-rule-2", SchemaVersion: 1, Previous: "pending", Current: "normal", Values: jsonifyValues(map[string]float64{"a": 0.5})}),
				}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-1",
						FolderUIDLabel:       "test-folder-1",
					}),
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-2",
						FolderUIDLabel:       "test-folder-1",
					}),
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-1",
						FolderUIDLabel:       "test-folder-1",
					}),
				}),
			),
		},
		{
			name:       "should filter streams by folder UID",
			folderUIDs: []string{"test-folder-1"},
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-1",
								"folderUID": "test-folder-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(1, 0), V: `{"schemaVersion": 1, "previous": "normal", "current": "pending", "values":{"a": 1.5}, "ruleUID": "test-rule-1"}`},
								{T: time.Unix(5, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "normal", "values":{"a": 0.5}, "ruleUID": "test-rule-2"}`},
							},
						},
						{
							Stream: map[string]string{
								"from":      "state-history",
								"orgID":     "1",
								"group":     "test-group-2",
								"folderUID": "test-folder-2",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(2, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "firing", "values":{"a": 2.5}, "ruleUID": "test-rule-3"}`},
							},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{
					time.Unix(1, 0),
					time.Unix(5, 0),
				}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{
					toJson(LokiEntry{RuleUID: "test-rule-1", SchemaVersion: 1, Previous: "normal", Current: "pending", Values: jsonifyValues(map[string]float64{"a": 1.5})}),
					toJson(LokiEntry{RuleUID: "test-rule-2", SchemaVersion: 1, Previous: "pending", Current: "normal", Values: jsonifyValues(map[string]float64{"a": 0.5})}),
				}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-1",
						FolderUIDLabel:       "test-folder-1",
					}),
					toJson(map[string]string{
						StateHistoryLabelKey: "state-history",
						OrgIDLabel:           "1",
						GroupLabel:           "test-group-1",
						FolderUIDLabel:       "test-folder-1",
					}),
				}),
			),
		},
		{
			name:       "should skip streams without folder UID if filter is specified",
			folderUIDs: []string{"test-folder-1"},
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"group": "test-group-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(1, 0), V: `{"schemaVersion": 1, "previous": "normal", "current": "pending", "values":{"a": 1.5}, "ruleUID": "test-rule-1"}`},
								{T: time.Unix(5, 0), V: `{"schemaVersion": 1, "previous": "pending", "current": "normal", "values":{"a": 0.5}, "ruleUID": "test-rule-2"}`},
							},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{}),
			),
		},
		{
			name:       "should return streams without folder UID if filter is not specified",
			folderUIDs: []string{},
			res: lokiclient.QueryRes{
				Data: lokiclient.QueryData{
					Result: []lokiclient.Stream{
						{
							Stream: map[string]string{
								"group": "test-group-1",
							},
							Values: []lokiclient.Sample{
								{T: time.Unix(1, 0), V: `{"schemaVersion": 1, "previous": "normal", "current": "pending", "values":{"a": 1.5}, "ruleUID": "test-rule-1"}`},
							},
						},
					},
				},
			},
			expected: data.NewFrame("states",
				data.NewField(dfTime, data.Labels{}, []time.Time{
					time.Unix(1, 0),
				}),
				data.NewField(dfLine, data.Labels{}, []json.RawMessage{
					toJson(LokiEntry{RuleUID: "test-rule-1", SchemaVersion: 1, Previous: "normal", Current: "pending", Values: jsonifyValues(map[string]float64{"a": 1.5})}),
				}),
				data.NewField(dfLabels, data.Labels{}, []json.RawMessage{
					toJson(map[string]string{
						GroupLabel: "test-group-1",
					}),
				}),
			),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			expectedJson, err := tc.expected.MarshalJSON()
			require.NoError(t, err)
			m, err := merge(tc.res.Data.Result, tc.folderUIDs)
			require.NoError(t, err)
			actualJson, err := m.MarshalJSON()
			assert.NoError(t, err)

			assert.Equal(t, tc.expected.Rows(), m.Rows())
			assert.JSONEq(t, string(expectedJson), string(actualJson))
		})
	}
}

func TestRecordStates(t *testing.T) {
	t.Run("writes state transitions to loki", func(t *testing.T) {
		req := lokiclient.NewFakeRequester()
		loki := createTestLokiBackend(t, req, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State:  eval.Alerting,
			Labels: data.Labels{"a": "b"},
		})

		err := <-loki.Record(context.Background(), rule, states)

		require.NoError(t, err)
		require.Contains(t, "/loki/api/v1/push", req.LastRequest.URL.Path)
	})

	t.Run("emits expected write metrics", func(t *testing.T) {
		reg := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(reg, metrics.Subsystem)
		loki := createTestLokiBackend(t, lokiclient.NewFakeRequester(), met)
		errLoki := createTestLokiBackend(t, lokiclient.NewFakeRequester().WithResponse(lokiclient.BadResponse()), met) //nolint:bodyclose
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State:  eval.Alerting,
			Labels: data.Labels{"a": "b"},
		})

		<-loki.Record(context.Background(), rule, states)
		<-errLoki.Record(context.Background(), rule, states)

		exp := bytes.NewBufferString(`
# HELP grafana_alerting_state_history_transitions_failed_total The total number of state transitions that failed to be written - they are not retried.
# TYPE grafana_alerting_state_history_transitions_failed_total counter
grafana_alerting_state_history_transitions_failed_total{org="1"} 1
# HELP grafana_alerting_state_history_transitions_total The total number of state transitions processed.
# TYPE grafana_alerting_state_history_transitions_total counter
grafana_alerting_state_history_transitions_total{org="1"} 2
# HELP grafana_alerting_state_history_writes_failed_total The total number of failed writes of state history batches.
# TYPE grafana_alerting_state_history_writes_failed_total counter
grafana_alerting_state_history_writes_failed_total{backend="loki",org="1"} 1
# HELP grafana_alerting_state_history_writes_total The total number of state history batches that were attempted to be written.
# TYPE grafana_alerting_state_history_writes_total counter
grafana_alerting_state_history_writes_total{backend="loki",org="1"} 2
`)
		err := testutil.GatherAndCompare(reg, exp,
			"grafana_alerting_state_history_transitions_total",
			"grafana_alerting_state_history_transitions_failed_total",
			"grafana_alerting_state_history_writes_total",
			"grafana_alerting_state_history_writes_failed_total",
		)
		require.NoError(t, err)
	})

	t.Run("elides request if nothing to send", func(t *testing.T) {
		req := lokiclient.NewFakeRequester()
		loki := createTestLokiBackend(t, req, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
		rule := createTestRule()
		states := []state.StateTransition{}

		err := <-loki.Record(context.Background(), rule, states)

		require.NoError(t, err)
		require.Nil(t, req.LastRequest)
	})

	t.Run("succeeds with special chars in labels", func(t *testing.T) {
		req := lokiclient.NewFakeRequester()
		loki := createTestLokiBackend(t, req, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State: eval.Alerting,
			Labels: data.Labels{
				"dots":   "contains.dot",
				"equals": "contains=equals",
				"emoji":  "contains🤔emoji",
			},
		})

		err := <-loki.Record(context.Background(), rule, states)

		require.NoError(t, err)
		require.Contains(t, "/loki/api/v1/push", req.LastRequest.URL.Path)
		sent := string(readBody(t, req.LastRequest))
		require.Contains(t, sent, "contains.dot")
		require.Contains(t, sent, "contains=equals")
		require.Contains(t, sent, "contains🤔emoji")
	})

	t.Run("adds external labels to log lines", func(t *testing.T) {
		req := lokiclient.NewFakeRequester()
		loki := createTestLokiBackend(t, req, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
		rule := createTestRule()
		states := singleFromNormal(&state.State{
			State: eval.Alerting,
		})

		err := <-loki.Record(context.Background(), rule, states)

		require.NoError(t, err)
		require.Contains(t, "/loki/api/v1/push", req.LastRequest.URL.Path)
		sent := string(readBody(t, req.LastRequest))
		require.Contains(t, sent, "externalLabelKey")
		require.Contains(t, sent, "externalLabelValue")
	})
}

func TestGetFolderUIDsForFilter(t *testing.T) {
	orgID := int64(1)
	rule := models.RuleGen.With(models.RuleMuts.WithNamespaceUID("folder-1")).GenerateRef()
	folders := []string{
		"folder-1",
		"folder-2",
		"folder-3",
	}
	usr := accesscontrol.BackgroundUser("test", 1, org.RoleNone, nil)

	createLoki := func(ac AccessControl) *RemoteLokiBackend {
		req := lokiclient.NewFakeRequester()
		loki := createTestLokiBackend(t, req, metrics.NewHistorianMetrics(prometheus.NewRegistry(), metrics.Subsystem))
		rules := fakes.NewRuleStore(t)
		f := make([]*folder.Folder, 0, len(folders))
		for _, uid := range folders {
			f = append(f, &folder.Folder{UID: uid, OrgID: orgID})
		}
		rules.Folders = map[int64][]*folder.Folder{
			orgID: f,
		}
		rules.Rules = map[int64][]*models.AlertRule{
			orgID: {rule},
		}
		loki.ruleStore = rules
		loki.ac = ac
		return loki
	}

	t.Run("when rule UID is specified", func(t *testing.T) {
		t.Run("should bypass authorization if user can read all rules", func(t *testing.T) {
			ac := &acfakes.FakeRuleService{}
			ac.CanReadAllRulesFunc = func(ctx context.Context, requester identity.Requester) (bool, error) {
				return true, nil
			}
			result, err := createLoki(ac).getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, RuleUID: rule.UID, SignedInUser: usr})
			assert.NoError(t, err)
			assert.Empty(t, result)

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].MethodName)
			assert.Equal(t, usr, ac.Calls[0].Arguments[1])

			t.Run("even if rule does not exist", func(t *testing.T) {
				result, err := createLoki(ac).getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, RuleUID: "not-found", SignedInUser: usr})
				assert.NoError(t, err)
				assert.Empty(t, result)
			})
		})

		t.Run("should authorize access to the rule", func(t *testing.T) {
			ac := &acfakes.FakeRuleService{}
			ac.CanReadAllRulesFunc = func(ctx context.Context, requester identity.Requester) (bool, error) {
				return false, nil
			}
			ac.AuthorizeAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) error {
				return nil
			}
			loki := createLoki(ac)

			result, err := loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, RuleUID: rule.UID, SignedInUser: usr})
			assert.NoError(t, err)
			assert.Empty(t, result)

			assert.Len(t, ac.Calls, 2)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].MethodName)
			assert.Equal(t, usr, ac.Calls[0].Arguments[1])
			assert.Equal(t, "AuthorizeAccessInFolder", ac.Calls[1].MethodName)
			assert.Equal(t, usr, ac.Calls[1].Arguments[1])
			assert.Equal(t, rule, ac.Calls[1].Arguments[2])

			t.Run("should fail if unauthorized", func(t *testing.T) {
				authzErr := errors.New("generic error")
				ac.AuthorizeAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) error {
					return authzErr
				}
				result, err = loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, RuleUID: rule.UID, SignedInUser: usr})
				require.ErrorIs(t, err, authzErr)
			})

			t.Run("should fail if rule does not exist", func(t *testing.T) {
				result, err = loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, RuleUID: "not-found", SignedInUser: usr})
				require.ErrorIs(t, err, models.ErrAlertRuleNotFound)
			})
		})
	})

	t.Run("when rule UID is empty", func(t *testing.T) {
		t.Run("should bypass authorization if user can read all rules", func(t *testing.T) {
			ac := &acfakes.FakeRuleService{}
			ac.CanReadAllRulesFunc = func(ctx context.Context, requester identity.Requester) (bool, error) {
				return true, nil
			}
			result, err := createLoki(ac).getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, SignedInUser: usr})
			assert.NoError(t, err)
			assert.Empty(t, result)

			assert.Len(t, ac.Calls, 1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].MethodName)
			assert.Equal(t, usr, ac.Calls[0].Arguments[1])
		})

		t.Run("should return only folders user has access to", func(t *testing.T) {
			ac := &acfakes.FakeRuleService{}
			ac.CanReadAllRulesFunc = func(ctx context.Context, requester identity.Requester) (bool, error) {
				return false, nil
			}
			ac.HasAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) (bool, error) {
				return true, nil
			}
			loki := createLoki(ac)

			result, err := loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, SignedInUser: usr})
			assert.NoError(t, err)
			assert.ElementsMatch(t, folders, result)

			assert.Len(t, ac.Calls, len(folders)+1)
			assert.Equal(t, "CanReadAllRules", ac.Calls[0].MethodName)
			assert.Equal(t, usr, ac.Calls[0].Arguments[1])

			var called []string
			for _, call := range ac.Calls[1:] {
				if !assert.Equal(t, "HasAccessInFolder", call.MethodName) {
					continue
				}
				assert.Equal(t, usr, call.Arguments[1])
				called = append(called, call.Arguments[2].(models.Namespaced).GetNamespaceUID())
			}
			assert.ElementsMatch(t, folders, called)

			t.Run("should fail if no folders to read", func(t *testing.T) {
				loki := createLoki(ac)
				loki.ruleStore = fakes.NewRuleStore(t)

				result, err = loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, SignedInUser: usr})
				require.ErrorIs(t, err, rulesAuthz.ErrAuthorizationBase)
				require.Empty(t, result)
			})

			t.Run("should fail if no folders to read alert rules in", func(t *testing.T) {
				ac.HasAccessInFolderFunc = func(ctx context.Context, requester identity.Requester, namespaced models.Namespaced) (bool, error) {
					return false, nil
				}
				result, err = loki.getFolderUIDsForFilter(context.Background(), models.HistoryQuery{OrgID: orgID, SignedInUser: usr})
				require.ErrorIs(t, err, rulesAuthz.ErrAuthorizationBase)
				require.Empty(t, result)
			})
		})
	})
}

func createTestLokiBackend(t *testing.T, req client.Requester, met *metrics.Historian) *RemoteLokiBackend {
	url, _ := url.Parse("http://some.url")
	cfg := lokiclient.LokiConfig{
		WritePathURL:   url,
		ReadPathURL:    url,
		Encoder:        lokiclient.JsonEncoder{},
		ExternalLabels: map[string]string{"externalLabelKey": "externalLabelValue"},
	}
	lokiBackendLogger := log.New("ngalert.state.historian", "backend", "loki")
	rules := fakes.NewRuleStore(t)
	ac := &acfakes.FakeRuleService{}
	return NewRemoteLokiBackend(lokiBackendLogger, cfg, req, met, tracing.InitializeTracerForTest(), rules, ac)
}

func singleFromNormal(st *state.State) []state.StateTransition {
	return []state.StateTransition{
		{
			PreviousState: eval.Normal,
			State:         st,
		},
	}
}

func createTestRule() history_model.RuleMeta {
	return history_model.RuleMeta{
		OrgID:        1,
		ID:           123,
		UID:          "rule-uid",
		Group:        "my-group",
		NamespaceUID: "my-folder",
		DashboardUID: "dash-uid",
		PanelID:      123,
		Title:        "my-title",
	}
}

func requireSingleEntry(t *testing.T, res lokiclient.Stream) LokiEntry {
	require.Len(t, res.Values, 1)
	return requireEntry(t, res.Values[0])
}

func requireEntry(t *testing.T, row lokiclient.Sample) LokiEntry {
	t.Helper()

	var entry LokiEntry
	err := json.Unmarshal([]byte(row.V), &entry)
	require.NoError(t, err)
	return entry
}

func readBody(t *testing.T, req *http.Request) []byte {
	t.Helper()

	val, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	return val
}

func toJson[T any](entry T) json.RawMessage {
	b, err := json.Marshal(entry)
	if err != nil {
		panic(err)
	}
	return b
}
