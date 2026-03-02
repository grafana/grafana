package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/notify/historian"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
)

// mockLokiClient implements the lokiClient interface for testing
type mockLokiClient struct {
	mock.Mock
}

func (m *mockLokiClient) RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error) {
	args := m.Called(ctx, logQL, start, end, limit)
	return args.Get(0).(lokiclient.QueryRes), args.Error(1)
}

func (m *mockLokiClient) MetricsQuery(ctx context.Context, logQL string, ts int64, limit int64) (lokiclient.MetricsQueryRes, error) {
	args := m.Called(ctx, logQL, ts, limit)
	return args.Get(0).(lokiclient.MetricsQueryRes), args.Error(1)
}

func TestLokiReader_Query(t *testing.T) {
	now := time.Now().UTC()
	testTimestamp := now.Add(-1 * time.Hour)

	tests := []struct {
		name          string
		query         Query
		lokiResponse  lokiclient.QueryRes
		responseError error
		experr        error
		validateFn    func(t *testing.T, result QueryResult)
	}{
		{
			name: "successful query with results",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
			},
			lokiResponse: createMockLokiResponse(testTimestamp),
			validateFn: func(t *testing.T, result QueryResult) {
				assert.Len(t, result.Entries, 1)
				assert.Equal(t, "test-receiver", result.Entries[0].Receiver)
				assert.Equal(t, Status("firing"), result.Entries[0].Status)
				assert.Equal(t, OutcomeSuccess, result.Entries[0].Outcome)
			},
		},
		{
			name: "query with custom time range",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				From:    timePtr(now.Add(-2 * time.Hour)),
				To:      timePtr(now),
			},
			lokiResponse: createMockLokiResponse(testTimestamp),
		},
		{
			name: "query with custom limit",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Limit:   int64Ptr(100),
			},
			lokiResponse: createMockLokiResponse(testTimestamp),
		},
		{
			name: "query with max limit",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Limit:   int64Ptr(1000),
			},
			lokiResponse: createMockLokiResponse(testTimestamp),
		},
		{
			name: "query with over max limit",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Limit:   int64Ptr(1001),
			},
			lokiResponse: createMockLokiResponse(testTimestamp),
			experr:       ErrInvalidQuery,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockLokiClient{}
			mockClient.On("RangeQuery", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(tt.lokiResponse, tt.responseError)

			reader := &LokiReader{
				client: mockClient,
				logger: &logging.NoOpLogger{},
			}

			result, err := reader.Query(context.Background(), tt.query)
			if tt.experr != nil {
				assert.ErrorIs(t, err, ErrInvalidQuery)
				return
			}

			require.NoError(t, err)
			if tt.validateFn != nil {
				tt.validateFn(t, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestBuildQuery(t *testing.T) {
	tests := []struct {
		name     string
		query    Query
		expected string
		experr   error
	}{
		{
			name:  "query with no filters",
			query: Query{},
			expected: fmt.Sprintf(`{%s=%q} | json`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with rule uid filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | json`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with receiver filter only",
			query: Query{
				Receiver: stringPtr("email-receiver"),
			},
			expected: fmt.Sprintf(`{%s=%q} | receiver = "email-receiver" | json`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with receiver filter",
			query: Query{
				RuleUID:  stringPtr("test-rule-uid"),
				Receiver: stringPtr("email-receiver"),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | receiver = "email-receiver" | json`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with status filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Status:  createStatusPtr(v0alpha1.CreateNotificationqueryRequestNotificationStatusFiring),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | json | status = "firing"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with success outcome filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Outcome: outcomePtr(v0alpha1.CreateNotificationqueryRequestNotificationOutcomeSuccess),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | json | error = ""`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with error outcome filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Outcome: outcomePtr(v0alpha1.CreateNotificationqueryRequestNotificationOutcomeError),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | json | error != ""`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with many filters",
			query: Query{
				RuleUID:  stringPtr("test-rule-uid"),
				Receiver: stringPtr("email-receiver"),
				Status:   createStatusPtr(v0alpha1.CreateNotificationqueryRequestNotificationStatusResolved),
				Outcome:  outcomePtr(v0alpha1.CreateNotificationqueryRequestNotificationOutcomeSuccess),
			},
			expected: fmt.Sprintf(`{%s=%q} | rule_uids =~ "(^|.*,)test-rule-uid($|,.*)" | receiver = "email-receiver" | json | status = "resolved" | error = ""`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with group label matcher",
			query: Query{
				GroupLabels: &Matchers{{Type: "=", Label: "foo", Value: "bar"}},
			},
			expected: fmt.Sprintf(`{%s=%q} | json | groupLabels_foo = "bar"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with many group label matchers",
			query: Query{
				GroupLabels: &Matchers{
					{Type: "=", Label: "f1", Value: "b1"},
					{Type: "!=", Label: "f2", Value: "b2"},
					{Type: "=~", Label: "f3", Value: "b3"},
					{Type: "!~", Label: "f4", Value: "b4"},
				},
			},
			expected: fmt.Sprintf(`{%s=%q} | json | groupLabels_f1 = "b1" | groupLabels_f2 != "b2"`+
				` | groupLabels_f3 =~ "b3" | groupLabels_f4 !~ "b4"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with invalid group label with space",
			query: Query{
				GroupLabels: &Matchers{{Type: "=", Label: "fo o", Value: "bar"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid group label starting with number",
			query: Query{
				GroupLabels: &Matchers{{Type: "=", Label: "1foo", Value: "bar"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid group label with attempted injection",
			query: Query{
				GroupLabels: &Matchers{{Type: "=", Label: "\" = \"ship\"", Value: "bar"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid group operator",
			query: Query{
				GroupLabels: &Matchers{{Type: "|=", Label: "foo", Value: "bar"}},
			},
			experr: ErrInvalidQuery,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := buildQuery(tt.query)
			if tt.experr != nil {
				require.ErrorIs(t, err, tt.experr)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestParseLokiEntry(t *testing.T) {
	now := time.Now().UTC()
	timestamp := now

	tests := []struct {
		name    string
		sample  lokiclient.Sample
		wantErr bool
		want    Entry
	}{
		{
			name: "valid entry with success outcome",
			sample: lokiclient.Sample{
				T: timestamp,
				V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
					SchemaVersion:  2,
					UUID:           "test-uuid",
					Receiver:       "test-receiver",
					Integration:    "email",
					IntegrationIdx: 0,
					Status:         "firing",
					Error:          "",
					GroupKey:       "key:thing",
					GroupLabels: map[string]string{
						"alertname": "test-alert",
					},
					RuleUIDs:     []string{"rule-uid-1"},
					AlertCount:   1,
					Retry:        false,
					Duration:     100,
					PipelineTime: now,
				}),
			},
			wantErr: false,
			want: Entry{
				Timestamp:        timestamp,
				Uuid:             "test-uuid",
				Receiver:         "test-receiver",
				Integration:      "email",
				IntegrationIndex: 0,
				Status:           Status("firing"),
				Outcome:          OutcomeSuccess,
				GroupKey:         "key:thing",
				GroupLabels: map[string]string{
					"alertname": "test-alert",
				},
				RuleUIDs:     []string{"rule-uid-1"},
				AlertCount:   1,
				Alerts:       []EntryAlert{},
				Retry:        false,
				Error:        nil,
				Duration:     100,
				PipelineTime: now,
			},
		},
		{
			name: "valid entry with error outcome",
			sample: lokiclient.Sample{
				T: timestamp,
				V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
					SchemaVersion: 2,
					UUID:          "test-uuid-2",
					Receiver:      "test-receiver",
					Status:        "firing",
					Error:         "notification failed",
					GroupKey:      "key:thing",
					GroupLabels:   map[string]string{},
					AlertCount:    1,
					PipelineTime:  now,
				}),
			},
			wantErr: false,
			want: Entry{
				Timestamp:    timestamp,
				Uuid:         "test-uuid-2",
				Receiver:     "test-receiver",
				Status:       Status("firing"),
				Outcome:      OutcomeError,
				GroupKey:     "key:thing",
				GroupLabels:  map[string]string{},
				RuleUIDs:     []string{},
				AlertCount:   1,
				Alerts:       []EntryAlert{},
				Error:        stringPtr("notification failed"),
				PipelineTime: now,
			},
		},
		{
			name: "entry with nil group labels",
			sample: lokiclient.Sample{
				T: timestamp,
				V: createLokiEntryJSONWithNilLabels(t, now),
			},
			wantErr: false,
			want: Entry{
				Timestamp:    timestamp,
				Receiver:     "test-receiver",
				Status:       Status("firing"),
				Outcome:      OutcomeSuccess,
				GroupLabels:  map[string]string{},
				RuleUIDs:     []string{},
				AlertCount:   1,
				Alerts:       []EntryAlert{},
				PipelineTime: now,
			},
		},
		{
			name: "invalid JSON",
			sample: lokiclient.Sample{
				T: timestamp,
				V: "invalid json",
			},
			wantErr: true,
		},
		{
			name: "unsupported schema version",
			sample: lokiclient.Sample{
				T: timestamp,
				V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
					SchemaVersion: 99,
					Receiver:      "test-receiver",
					PipelineTime:  now,
				}),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseLokiEntry(tt.sample)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.want.Timestamp, got.Timestamp)
			assert.Equal(t, tt.want.Uuid, got.Uuid)
			assert.Equal(t, tt.want.Receiver, got.Receiver)
			assert.Equal(t, tt.want.Integration, got.Integration)
			assert.Equal(t, tt.want.IntegrationIndex, got.IntegrationIndex)
			assert.Equal(t, tt.want.Status, got.Status)
			assert.Equal(t, tt.want.Outcome, got.Outcome)
			assert.Equal(t, tt.want.GroupKey, got.GroupKey)
			assert.Equal(t, tt.want.GroupLabels, got.GroupLabels)
			assert.Equal(t, tt.want.RuleUIDs, got.RuleUIDs)
			assert.Equal(t, tt.want.AlertCount, got.AlertCount)
			assert.Equal(t, tt.want.Alerts, got.Alerts)
			assert.Equal(t, tt.want.Retry, got.Retry)
			assert.Equal(t, tt.want.Duration, got.Duration)
			assert.Equal(t, tt.want.PipelineTime, got.PipelineTime)

			if tt.want.Error != nil {
				require.NotNil(t, got.Error)
				assert.Equal(t, *tt.want.Error, *got.Error)
			} else {
				assert.Nil(t, got.Error)
			}
		})
	}
}

func TestLokiReader_RunQuery(t *testing.T) {
	now := time.Now().UTC()

	entry1Time := now.Add(-3 * time.Hour)
	entry2Time := now.Add(-2 * time.Hour)
	entry3Time := now.Add(-1 * time.Hour)

	mockResponse := lokiclient.QueryRes{
		Data: lokiclient.QueryData{
			Result: []lokiclient.Stream{
				{
					Values: []lokiclient.Sample{
						{
							T: entry1Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 2,
								UUID:          "uuid-1",
								Receiver:      "receiver-1",
								Status:        "firing",
								GroupKey:      "group1",
								GroupLabels:   map[string]string{},
								AlertCount:    1,
								PipelineTime:  entry1Time,
							}),
						},
						{
							T: entry3Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 2,
								UUID:          "uuid-3",
								Receiver:      "receiver-3",
								Status:        "firing",
								GroupKey:      "group3",
								GroupLabels:   map[string]string{},
								AlertCount:    1,
								PipelineTime:  entry3Time,
							}),
						},
					},
				},
				{
					Values: []lokiclient.Sample{
						{
							T: entry2Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 2,
								UUID:          "uuid-2",
								Receiver:      "receiver-2",
								Status:        "firing",
								GroupKey:      "group2",
								GroupLabels:   map[string]string{},
								AlertCount:    1,
								PipelineTime:  entry2Time,
							}),
						},
					},
				},
			},
		},
	}

	mockClient := &mockLokiClient{}
	mockClient.On("RangeQuery", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
		Return(mockResponse, nil)

	reader := &LokiReader{
		client: mockClient,
		logger: &logging.NoOpLogger{},
	}

	entries, err := reader.runQuery(context.Background(), "test query", now.Add(-6*time.Hour), now, 1000)
	require.NoError(t, err)
	require.Len(t, entries, 3)

	mockClient.AssertExpectations(t)

	assert.Equal(t, "receiver-3", entries[0].Receiver)
	assert.Equal(t, "receiver-2", entries[1].Receiver)
	assert.Equal(t, "receiver-1", entries[2].Receiver)
	assert.Equal(t, entries[0].Timestamp, entry3Time)
	assert.Equal(t, entries[1].Timestamp, entry2Time)
	assert.Equal(t, entries[2].Timestamp, entry1Time)
}

func TestLokiReader_QueryAlerts(t *testing.T) {
	now := time.Now().UTC()
	testTimestamp := now.Add(-1 * time.Hour)

	tests := []struct {
		name          string
		query         AlertQuery
		lokiResponse  lokiclient.QueryRes
		responseError error
		experr        error
		validateFn    func(t *testing.T, result AlertQueryResult)
	}{
		{
			name:         "successful query with results",
			query:        AlertQuery{Uuid: stringPtr("test-uuid")},
			lokiResponse: createMockAlertLokiResponse(testTimestamp),
			validateFn: func(t *testing.T, result AlertQueryResult) {
				assert.Len(t, result.Alerts, 1)
				assert.Equal(t, "firing", result.Alerts[0].Status)
				assert.Equal(t, map[string]string{"alertname": "test-alert"}, result.Alerts[0].Labels)
			},
		},
		{
			name: "query with custom time range",
			query: AlertQuery{
				Uuid: stringPtr("test-uuid"),
				From: timePtr(now.Add(-2 * time.Hour)),
				To:   timePtr(now),
			},
			lokiResponse: createMockAlertLokiResponse(testTimestamp),
		},
		{
			name: "query with custom limit",
			query: AlertQuery{
				Uuid:  stringPtr("test-uuid"),
				Limit: int64Ptr(10),
			},
			lokiResponse: createMockAlertLokiResponse(testTimestamp),
		},
		{
			name: "query with over max limit",
			query: AlertQuery{
				Uuid:  stringPtr("test-uuid"),
				Limit: int64Ptr(1001),
			},
			lokiResponse: createMockAlertLokiResponse(testTimestamp),
			experr:       ErrInvalidQuery,
		},
		{
			name:          "loki error is propagated",
			query:         AlertQuery{Uuid: stringPtr("test-uuid")},
			lokiResponse:  lokiclient.QueryRes{},
			responseError: fmt.Errorf("loki unavailable"),
			experr:        fmt.Errorf("loki unavailable"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockLokiClient{}
			mockClient.On("RangeQuery", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(tt.lokiResponse, tt.responseError)

			reader := &LokiReader{
				client: mockClient,
				logger: &logging.NoOpLogger{},
			}

			result, err := reader.QueryAlerts(context.Background(), tt.query)
			if tt.experr != nil {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			if tt.validateFn != nil {
				tt.validateFn(t, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestBuildAlertQuery(t *testing.T) {
	tests := []struct {
		name     string
		query    AlertQuery
		expected string
	}{
		{
			name:  "query with no filters",
			query: AlertQuery{},
			expected: fmt.Sprintf(`{%s=%q} | json`,
				historian.LabelFrom, historian.LabelFromValueAlerts),
		},
		{
			name:  "query with uuid filter",
			query: AlertQuery{Uuid: stringPtr("test-uuid-123")},
			expected: fmt.Sprintf(`{%s=%q} | uuid = "test-uuid-123" | json`,
				historian.LabelFrom, historian.LabelFromValueAlerts),
		},
		{
			name:  "query with empty uuid is ignored",
			query: AlertQuery{Uuid: stringPtr("")},
			expected: fmt.Sprintf(`{%s=%q} | json`,
				historian.LabelFrom, historian.LabelFromValueAlerts),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := buildAlertQuery(tt.query)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseLokiAlertEntry(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	startsAt := now.Add(-30 * time.Minute)
	endsAt := now.Add(-5 * time.Minute)

	tests := []struct {
		name    string
		sample  lokiclient.Sample
		wantErr bool
		want    AlertEntry
	}{
		{
			name: "valid firing alert entry",
			sample: lokiclient.Sample{
				T: now,
				V: createLokiAlertEntryJSON(t, historian.NotificationHistoryLokiEntryAlert{
					SchemaVersion: 2,
					UUID:          "test-uuid",
					AlertIndex:    0,
					Status:        "firing",
					Labels:        map[string]string{"alertname": "test-alert", "severity": "critical"},
					Annotations:   map[string]string{"summary": "something is on fire"},
					StartsAt:      startsAt,
					EndsAt:        endsAt,
				}),
			},
			want: AlertEntry{
				Status:      "firing",
				Labels:      map[string]string{"alertname": "test-alert", "severity": "critical"},
				Annotations: map[string]string{"summary": "something is on fire"},
				StartsAt:    startsAt,
				EndsAt:      endsAt,
			},
		},
		{
			name: "valid resolved alert entry",
			sample: lokiclient.Sample{
				T: now,
				V: createLokiAlertEntryJSON(t, historian.NotificationHistoryLokiEntryAlert{
					SchemaVersion: 2,
					UUID:          "test-uuid-2",
					Status:        "resolved",
					Labels:        map[string]string{"alertname": "test-alert"},
					Annotations:   map[string]string{},
					StartsAt:      startsAt,
					EndsAt:        endsAt,
				}),
			},
			want: AlertEntry{
				Status:      "resolved",
				Labels:      map[string]string{"alertname": "test-alert"},
				Annotations: map[string]string{},
				StartsAt:    startsAt,
				EndsAt:      endsAt,
			},
		},
		{
			name: "nil labels and annotations are replaced with empty maps",
			sample: lokiclient.Sample{
				T: now,
				V: createLokiAlertEntryJSON(t, historian.NotificationHistoryLokiEntryAlert{
					SchemaVersion: 2,
					Status:        "firing",
					Labels:        nil,
					Annotations:   nil,
					StartsAt:      startsAt,
					EndsAt:        endsAt,
				}),
			},
			want: AlertEntry{
				Status:      "firing",
				Labels:      map[string]string{},
				Annotations: map[string]string{},
				StartsAt:    startsAt,
				EndsAt:      endsAt,
			},
		},
		{
			name: "invalid JSON",
			sample: lokiclient.Sample{
				T: now,
				V: "not valid json",
			},
			wantErr: true,
		},
		{
			name: "unsupported schema version",
			sample: lokiclient.Sample{
				T: now,
				V: createLokiAlertEntryJSON(t, historian.NotificationHistoryLokiEntryAlert{
					SchemaVersion: 99,
					Status:        "firing",
				}),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseLokiAlertEntry(tt.sample)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.want.Status, got.Status)
			assert.Equal(t, tt.want.Labels, got.Labels)
			assert.Equal(t, tt.want.Annotations, got.Annotations)
			assert.Equal(t, tt.want.StartsAt, got.StartsAt)
			assert.Equal(t, tt.want.EndsAt, got.EndsAt)
		})
	}
}

func TestLokiReader_Query_Counts(t *testing.T) {
	now := time.Now().UTC()
	queryTypeCounts := v0alpha1.CreateNotificationqueryRequestBodyTypeCounts

	makeMetricSample := func(count string, metric map[string]string) lokiclient.MetricSample {
		ts, _ := json.Marshal(now.Unix())
		val, _ := json.Marshal(count)
		return lokiclient.MetricSample{
			Metric: metric,
			Value:  lokiclient.MetricSampleValue{ts, val},
		}
	}

	tests := []struct {
		name          string
		query         Query
		lokiResponse  lokiclient.MetricsQueryRes
		responseError error
		experr        error
		validateFn    func(t *testing.T, result QueryResult)
	}{
		{
			name: "successful counts query with results",
			query: Query{
				Type:    &queryTypeCounts,
				RuleUID: stringPtr("test-rule-uid"),
				GroupBy: &QueryGroupBy{Receiver: true},
			},
			lokiResponse: lokiclient.MetricsQueryRes{
				Data: lokiclient.MetricsQueryData{
					Result: []lokiclient.MetricSample{
						makeMetricSample("42", map[string]string{"receiver": "email"}),
					},
				},
			},
			validateFn: func(t *testing.T, result QueryResult) {
				require.Len(t, result.Counts, 1)
				assert.Equal(t, int64(42), result.Counts[0].Count)
				require.NotNil(t, result.Counts[0].Receiver)
				assert.Equal(t, "email", *result.Counts[0].Receiver)
			},
		},
		{
			name: "counts query with over max limit",
			query: Query{
				Type:  &queryTypeCounts,
				Limit: int64Ptr(1001),
			},
			lokiResponse: lokiclient.MetricsQueryRes{},
			experr:       ErrInvalidQuery,
		},
		{
			name: "counts query loki error is propagated",
			query: Query{
				Type:    &queryTypeCounts,
				RuleUID: stringPtr("test-rule-uid"),
			},
			lokiResponse:  lokiclient.MetricsQueryRes{},
			responseError: fmt.Errorf("loki unavailable"),
			experr:        fmt.Errorf("loki unavailable"),
		},
		{
			name: "counts sorted by count descending",
			query: Query{
				Type:    &queryTypeCounts,
				GroupBy: &QueryGroupBy{Receiver: true},
			},
			lokiResponse: lokiclient.MetricsQueryRes{
				Data: lokiclient.MetricsQueryData{
					Result: []lokiclient.MetricSample{
						makeMetricSample("5", map[string]string{"receiver": "slack"}),
						makeMetricSample("20", map[string]string{"receiver": "email"}),
						makeMetricSample("10", map[string]string{"receiver": "pagerduty"}),
					},
				},
			},
			validateFn: func(t *testing.T, result QueryResult) {
				require.Len(t, result.Counts, 3)
				assert.Equal(t, int64(20), result.Counts[0].Count)
				assert.Equal(t, int64(10), result.Counts[1].Count)
				assert.Equal(t, int64(5), result.Counts[2].Count)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mockLokiClient{}
			mockClient.On("MetricsQuery", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(tt.lokiResponse, tt.responseError)

			reader := &LokiReader{
				client: mockClient,
				logger: &logging.NoOpLogger{},
			}

			result, err := reader.Query(context.Background(), tt.query)
			if tt.experr != nil {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			if tt.validateFn != nil {
				tt.validateFn(t, result)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestBuildMetricsQuery(t *testing.T) {
	now := time.Now().UTC()
	from := now.Add(-6 * time.Hour)
	rangeSeconds := int64(now.Sub(from).Seconds())

	tests := []struct {
		name       string
		logqlInner string
		from       time.Time
		to         time.Time
		limit      int64
		groupBy    QueryGroupBy
		expected   string
	}{
		{
			name:       "no grouping",
			logqlInner: `{foo="bar"} | json`,
			from:       from,
			to:         now,
			limit:      100,
			groupBy:    QueryGroupBy{},
			expected:   fmt.Sprintf(`topk(100, sum(count_over_time({foo="bar"} | json[%ds])))`, rangeSeconds),
		},
		{
			name:       "group by receiver",
			logqlInner: `{foo="bar"} | json`,
			from:       from,
			to:         now,
			limit:      100,
			groupBy:    QueryGroupBy{Receiver: true},
			expected:   fmt.Sprintf(`topk(100, sum by (receiver) (count_over_time({foo="bar"} | json[%ds])))`, rangeSeconds),
		},
		{
			name:       "group by receiver and status",
			logqlInner: `{foo="bar"} | json`,
			from:       from,
			to:         now,
			limit:      50,
			groupBy:    QueryGroupBy{Receiver: true, Status: true},
			expected:   fmt.Sprintf(`topk(50, sum by (receiver,status) (count_over_time({foo="bar"} | json[%ds])))`, rangeSeconds),
		},
		{
			name:       "group by outcome adds label_format",
			logqlInner: `{foo="bar"} | json`,
			from:       from,
			to:         now,
			limit:      100,
			groupBy:    QueryGroupBy{Outcome: true},
			expected: fmt.Sprintf(`topk(100, sum by (outcome) (count_over_time({foo="bar"} | json`+
				` | label_format outcome="{{ if .error }}error{{ else }}success{{ end }}"[%ds])))`, rangeSeconds),
		},
		{
			name:       "group by all fields",
			logqlInner: `{foo="bar"} | json`,
			from:       from,
			to:         now,
			limit:      100,
			groupBy:    QueryGroupBy{Receiver: true, Integration: true, IntegrationIndex: true, Status: true, Outcome: true, Error: true},
			expected: fmt.Sprintf(`topk(100, sum by (receiver,integration,integrationIdx,status,outcome,error) `+
				`(count_over_time({foo="bar"} | json`+
				` | label_format outcome="{{ if .error }}error{{ else }}success{{ end }}"[%ds])))`, rangeSeconds),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildMetricsQuery(tt.logqlInner, tt.from, tt.to, tt.limit, tt.groupBy)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseCount(t *testing.T) {
	makeValue := func(count string) lokiclient.MetricSampleValue {
		ts, _ := json.Marshal(1234567890.0)
		val, _ := json.Marshal(count)
		return lokiclient.MetricSampleValue{ts, val}
	}

	tests := []struct {
		name    string
		sample  lokiclient.MetricSample
		wantErr bool
		want    Count
	}{
		{
			name: "count only",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{},
				Value:  makeValue("42"),
			},
			want: Count{Count: 42},
		},
		{
			name: "with receiver",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"receiver": "email"},
				Value:  makeValue("10"),
			},
			want: Count{Count: 10, Receiver: stringPtr("email")},
		},
		{
			name: "with integration and integrationIdx",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"integration": "slack", "integrationIdx": "2"},
				Value:  makeValue("5"),
			},
			want: Count{Count: 5, Integration: stringPtr("slack"), IntegrationIndex: int64Ptr(2)},
		},
		{
			name: "with status",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"status": "firing"},
				Value:  makeValue("7"),
			},
			want: Count{Count: 7, Status: countStatusPtr("firing")},
		},
		{
			name: "with outcome",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"outcome": "success"},
				Value:  makeValue("3"),
			},
			want: Count{Count: 3, Outcome: countOutcomePtr("success")},
		},
		{
			name: "with error",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"error": "connection refused"},
				Value:  makeValue("1"),
			},
			want: Count{Count: 1, Error: stringPtr("connection refused")},
		},
		{
			name: "non-integer count",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{},
				Value:  makeValue("not-a-number"),
			},
			wantErr: true,
		},
		{
			name: "non-integer integrationIdx",
			sample: lokiclient.MetricSample{
				Metric: map[string]string{"integrationIdx": "bad"},
				Value:  makeValue("1"),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseCount(tt.sample)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.want.Count, got.Count)
			assert.Equal(t, tt.want.Receiver, got.Receiver)
			assert.Equal(t, tt.want.Integration, got.Integration)
			assert.Equal(t, tt.want.IntegrationIndex, got.IntegrationIndex)
			assert.Equal(t, tt.want.Status, got.Status)
			assert.Equal(t, tt.want.Outcome, got.Outcome)
			assert.Equal(t, tt.want.Error, got.Error)
		})
	}
}

// Helper functions

func stringPtr(s string) *string {
	return &s
}

func int64Ptr(i int64) *int64 {
	return &i
}

func timePtr(t time.Time) *time.Time {
	return &t
}

func createStatusPtr(s v0alpha1.CreateNotificationqueryRequestNotificationStatus) *v0alpha1.CreateNotificationqueryRequestNotificationStatus {
	return &s
}

func outcomePtr(o v0alpha1.CreateNotificationqueryRequestNotificationOutcome) *v0alpha1.CreateNotificationqueryRequestNotificationOutcome {
	return &o
}

func createMockLokiResponse(timestamp time.Time) lokiclient.QueryRes {
	return lokiclient.QueryRes{
		Data: lokiclient.QueryData{
			Result: []lokiclient.Stream{
				{
					Values: []lokiclient.Sample{
						{
							T: timestamp,
							V: createLokiEntryJSON(nil, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 2,
								UUID:          "test-uuid",
								Receiver:      "test-receiver",
								Status:        "firing",
								Error:         "",
								GroupKey:      "key:thing",
								GroupLabels: map[string]string{
									"alertname": "test-alert",
								},
								RuleUIDs:     []string{"rule-uid-1"},
								AlertCount:   1,
								Retry:        false,
								Duration:     100,
								PipelineTime: timestamp,
							}),
						},
					},
				},
			},
		},
	}
}

func createLokiEntryJSON(t *testing.T, entry historian.NotificationHistoryLokiEntry) string {
	data, err := json.Marshal(entry)
	if t != nil && err != nil {
		t.Fatalf("failed to marshal entry: %v", err)
	}
	return string(data)
}

func createLokiAlertEntryJSON(t *testing.T, entry historian.NotificationHistoryLokiEntryAlert) string {
	data, err := json.Marshal(entry)
	if err != nil {
		t.Fatalf("failed to marshal alert entry: %v", err)
	}
	return string(data)
}

func createMockAlertLokiResponse(timestamp time.Time) lokiclient.QueryRes {
	startsAt := timestamp.Add(-30 * time.Minute)
	endsAt := timestamp.Add(-5 * time.Minute)
	return lokiclient.QueryRes{
		Data: lokiclient.QueryData{
			Result: []lokiclient.Stream{
				{
					Values: []lokiclient.Sample{
						{
							T: timestamp,
							V: createLokiAlertEntryJSON(nil, historian.NotificationHistoryLokiEntryAlert{
								SchemaVersion: 2,
								UUID:          "test-uuid",
								AlertIndex:    0,
								Status:        "firing",
								Labels:        map[string]string{"alertname": "test-alert"},
								Annotations:   map[string]string{},
								StartsAt:      startsAt,
								EndsAt:        endsAt,
							}),
						},
					},
				},
			},
		},
	}
}

func countStatusPtr(s v0alpha1.CreateNotificationqueryNotificationStatus) *v0alpha1.CreateNotificationqueryNotificationStatus {
	return &s
}

func countOutcomePtr(o v0alpha1.CreateNotificationqueryNotificationOutcome) *v0alpha1.CreateNotificationqueryNotificationOutcome {
	return &o
}

func createLokiEntryJSONWithNilLabels(t *testing.T, timestamp time.Time) string {
	// Create JSON with explicit null for group_labels
	jsonStr := fmt.Sprintf(`{
		"schemaVersion": 2,
		"uuid": "",
		"receiver": "test-receiver",
		"status": "firing",
		"error": "",
		"groupLabels": null,
		"alertCount": 1,
		"retry": false,
		"duration": 0,
		"pipelineTime": "%s"
	}`, timestamp.Format(time.RFC3339Nano))
	return jsonStr
}
