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

	"github.com/grafana/alerting/models"
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
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with receiver filter",
			query: Query{
				RuleUID:  stringPtr("test-rule-uid"),
				Receiver: stringPtr("email-receiver"),
			},
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid" | receiver = "email-receiver"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with status filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Status:  createStatusPtr(v0alpha1.CreateNotificationqueryRequestNotificationStatusFiring),
			},
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid" | status = "firing"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with success outcome filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Outcome: outcomePtr(v0alpha1.CreateNotificationqueryRequestNotificationOutcomeSuccess),
			},
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid" | error = ""`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with error outcome filter",
			query: Query{
				RuleUID: stringPtr("test-rule-uid"),
				Outcome: outcomePtr(v0alpha1.CreateNotificationqueryRequestNotificationOutcomeError),
			},
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid" | error != ""`,
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
			expected: fmt.Sprintf(`{%s=%q} |= "test-rule-uid" | json | alert_labels___alert_rule_uid__ = "test-rule-uid" | receiver = "email-receiver" | status = "resolved" | error = ""`,
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
		{
			name: "query with alert label matcher",
			query: Query{
				Labels: &Matchers{{Type: "=", Label: "severity", Value: "critical"}},
			},
			expected: fmt.Sprintf(`{%s=%q} | json | alert_labels_severity = "critical"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with many alert label matchers",
			query: Query{
				Labels: &Matchers{
					{Type: "=", Label: "severity", Value: "critical"},
					{Type: "!=", Label: "env", Value: "test"},
					{Type: "=~", Label: "team", Value: "platform.*"},
					{Type: "!~", Label: "region", Value: "us-.*"},
				},
			},
			expected: fmt.Sprintf(`{%s=%q} | json | alert_labels_severity = "critical" | alert_labels_env != "test"`+
				` | alert_labels_team =~ "platform.*" | alert_labels_region !~ "us-.*"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with both group labels and alert labels",
			query: Query{
				GroupLabels: &Matchers{{Type: "=", Label: "alertname", Value: "HighCPU"}},
				Labels:      &Matchers{{Type: "=", Label: "severity", Value: "critical"}},
			},
			expected: fmt.Sprintf(`{%s=%q} | json | groupLabels_alertname = "HighCPU" | alert_labels_severity = "critical"`,
				historian.LabelFrom, historian.LabelFromValue),
		},
		{
			name: "query with invalid alert label with space",
			query: Query{
				Labels: &Matchers{{Type: "=", Label: "seve rity", Value: "critical"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid alert label starting with number",
			query: Query{
				Labels: &Matchers{{Type: "=", Label: "1severity", Value: "critical"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid alert label with attempted injection",
			query: Query{
				Labels: &Matchers{{Type: "=", Label: "\" = \"inject\"", Value: "critical"}},
			},
			experr: ErrInvalidQuery,
		},
		{
			name: "query with invalid alert label operator",
			query: Query{
				Labels: &Matchers{{Type: "|=", Label: "severity", Value: "critical"}},
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
					SchemaVersion: 1,
					Receiver:      "test-receiver",
					Status:        "firing",
					Error:         "",
					GroupKey:      "key:thing",
					GroupLabels: map[string]string{
						"alertname": "test-alert",
					},
					Alert: historian.NotificationHistoryLokiEntryAlert{
						Status: "firing",
						Labels: map[string]string{
							"severity": "critical",
						},
						Annotations: map[string]string{
							"summary": "Test alert",
						},
						StartsAt: now,
						EndsAt:   now.Add(1 * time.Hour),
					},
					AlertIndex:   0,
					AlertCount:   1,
					Retry:        false,
					Duration:     100,
					PipelineTime: now,
				}),
			},
			wantErr: false,
			want: Entry{
				Timestamp: timestamp,
				Receiver:  "test-receiver",
				Status:    Status("firing"),
				Outcome:   OutcomeSuccess,
				GroupKey:  "key:thing",
				GroupLabels: map[string]string{
					"alertname": "test-alert",
				},
				Alerts: []EntryAlert{
					{
						Status: "firing",
						Labels: map[string]string{
							"severity": "critical",
						},
						Annotations: map[string]string{
							"summary": "Test alert",
						},
						StartsAt: now,
						EndsAt:   now.Add(1 * time.Hour),
					},
				},
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
					SchemaVersion: 1,
					Receiver:      "test-receiver",
					Status:        "firing",
					Error:         "notification failed",
					GroupKey:      "key:thing",
					GroupLabels:   map[string]string{},
					Alert:         historian.NotificationHistoryLokiEntryAlert{},
					AlertIndex:    0,
					AlertCount:    1,
					PipelineTime:  now,
				}),
			},
			wantErr: false,
			want: Entry{
				Timestamp:    timestamp,
				Receiver:     "test-receiver",
				Status:       Status("firing"),
				Outcome:      OutcomeError,
				GroupKey:     "key:thing",
				GroupLabels:  map[string]string{},
				Alerts:       []EntryAlert{{}},
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
				Alerts:       []EntryAlert{{}},
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
			assert.Equal(t, tt.want.Receiver, got.Receiver)
			assert.Equal(t, tt.want.Status, got.Status)
			assert.Equal(t, tt.want.Outcome, got.Outcome)
			assert.Equal(t, tt.want.GroupKey, got.GroupKey)
			assert.Equal(t, tt.want.GroupLabels, got.GroupLabels)
			assert.Equal(t, tt.want.Retry, got.Retry)
			assert.Equal(t, tt.want.Duration, got.Duration)
			assert.Equal(t, tt.want.PipelineTime, got.PipelineTime)

			if tt.want.Error != nil {
				require.NotNil(t, got.Error)
				assert.Equal(t, *tt.want.Error, *got.Error)
			} else {
				assert.Nil(t, got.Error)
			}

			assert.Equal(t, len(tt.want.Alerts), len(got.Alerts))
			for i := range tt.want.Alerts {
				assert.Equal(t, tt.want.Alerts[i].Status, got.Alerts[i].Status)
				assert.Equal(t, tt.want.Alerts[i].Labels, got.Alerts[i].Labels)
				assert.Equal(t, tt.want.Alerts[i].Annotations, got.Alerts[i].Annotations)
				assert.Equal(t, tt.want.Alerts[i].StartsAt, got.Alerts[i].StartsAt)
				assert.Equal(t, tt.want.Alerts[i].EndsAt, got.Alerts[i].EndsAt)
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
								SchemaVersion: 1,
								Receiver:      "receiver-1",
								Status:        "firing",
								GroupKey:      "group1",
								GroupLabels:   map[string]string{},
								Alert:         historian.NotificationHistoryLokiEntryAlert{},
								AlertIndex:    0,
								AlertCount:    1,
								PipelineTime:  entry1Time,
							}),
						},
						{
							T: entry3Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-3",
								Status:        "firing",
								GroupKey:      "group3",
								GroupLabels:   map[string]string{},
								Alert:         historian.NotificationHistoryLokiEntryAlert{},
								AlertIndex:    0,
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
								SchemaVersion: 1,
								Receiver:      "receiver-2",
								Status:        "firing",
								GroupKey:      "group2",
								GroupLabels:   map[string]string{},
								Alert:         historian.NotificationHistoryLokiEntryAlert{},
								AlertIndex:    0,
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
								SchemaVersion: 1,
								Receiver:      "test-receiver",
								Status:        "firing",
								Error:         "",
								GroupKey:      "key:thing",
								GroupLabels: map[string]string{
									"alertname": "test-alert",
								},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "firing",
									Labels: map[string]string{
										"severity": "critical",
									},
									Annotations: map[string]string{
										"summary": "Test alert",
									},
									StartsAt: timestamp,
									EndsAt:   timestamp.Add(1 * time.Hour),
								},
								AlertIndex:   0,
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

func createLokiEntryJSONWithNilLabels(t *testing.T, timestamp time.Time) string {
	// Create JSON with explicit null for group_labels
	jsonStr := fmt.Sprintf(`{
		"schemaVersion": 1,
		"receiver": "test-receiver",
		"status": "firing",
		"error": "",
		"groupLabels": null,
		"alert": {},
		"alertIndex": 0,
		"alertCount": 1,
		"retry": false,
		"duration": 0,
		"pipelineTime": "%s"
	}`, timestamp.Format(time.RFC3339Nano))
	return jsonStr
}

func TestRuleUIDLabelConstant(t *testing.T) {
	// Verify that models.RuleUIDLabel has the expected value.
	// If this changes in the alerting module, our LogQL field path constant will be incorrect
	// and filtering for a single alert rule by its UID will break.
	assert.Equal(t, "__alert_rule_uid__", models.RuleUIDLabel)
}

func TestGroupAlerts(t *testing.T) {
	now := time.Now().UTC()
	pipelineTime := now.Add(-5 * time.Minute)

	tests := []struct {
		name     string
		entries  []Entry
		expected []Entry
	}{
		{
			name:     "empty entries",
			entries:  []Entry{},
			expected: []Entry{},
		},
		{
			name: "single entry with single alert",
			entries: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
			},
		},
		{
			name: "multiple alerts for same notification",
			entries: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "3"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
						{Status: "firing", Labels: map[string]string{"alert": "3"}},
					},
				},
			},
		},
		{
			name: "different group keys - separate notifications",
			entries: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group2",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group2",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
		},
		{
			name: "different timestamps - same notification (grouped)",
			entries: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now.Add(-1 * time.Second),
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
		},
		{
			name: "different pipeline times - separate notifications",
			entries: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime.Add(-1 * time.Second),
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime.Add(-1 * time.Second),
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
			},
		},
		{
			name: "complex scenario with mixed grouping",
			entries: []Entry{
				// Notification 1: group1, pipeline1 (3 alerts across different timestamps)
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
					},
				},
				// Notification 2: group2, pipeline1 (1 alert)
				{
					Timestamp:    now,
					GroupKey:     "group2",
					PipelineTime: pipelineTime,
					Receiver:     "receiver2",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "3"}},
					},
				},
				// This entry will be grouped with the first two (same groupKey and pipelineTime)
				{
					Timestamp:    now.Add(-1 * time.Minute),
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "resolved",
					Alerts: []EntryAlert{
						{Status: "resolved", Labels: map[string]string{"alert": "4"}},
					},
				},
			},
			expected: []Entry{
				{
					Timestamp:    now,
					GroupKey:     "group1",
					PipelineTime: pipelineTime,
					Receiver:     "receiver1",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "1"}},
						{Status: "firing", Labels: map[string]string{"alert": "2"}},
						{Status: "resolved", Labels: map[string]string{"alert": "4"}},
					},
				},
				{
					Timestamp:    now,
					GroupKey:     "group2",
					PipelineTime: pipelineTime,
					Receiver:     "receiver2",
					Status:       "firing",
					Alerts: []EntryAlert{
						{Status: "firing", Labels: map[string]string{"alert": "3"}},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := groupEntries(tt.entries)
			require.Equal(t, len(tt.expected), len(result), "number of grouped notifications should match")

			for i := range tt.expected {
				assert.Equal(t, tt.expected[i].Timestamp, result[i].Timestamp, "timestamp should match")
				assert.Equal(t, tt.expected[i].GroupKey, result[i].GroupKey, "groupKey should match")
				assert.Equal(t, tt.expected[i].PipelineTime, result[i].PipelineTime, "pipelineTime should match")
				assert.Equal(t, tt.expected[i].Receiver, result[i].Receiver, "receiver should match")
				assert.Equal(t, tt.expected[i].Status, result[i].Status, "status should match")
				assert.Equal(t, len(tt.expected[i].Alerts), len(result[i].Alerts), "number of alerts should match")

				for j := range tt.expected[i].Alerts {
					assert.Equal(t, tt.expected[i].Alerts[j].Status, result[i].Alerts[j].Status, "alert status should match")
					assert.Equal(t, tt.expected[i].Alerts[j].Labels, result[i].Alerts[j].Labels, "alert labels should match")
				}
			}
		})
	}
}

func TestLokiReader_RunQueryWithGrouping(t *testing.T) {
	now := time.Now().UTC()
	pipelineTime := now.Add(-5 * time.Minute)

	entry2Time := now.Add(-2 * time.Hour)
	entry3Time := now.Add(-1 * time.Hour)

	// Create a mock response with 5 log lines representing 2 notifications:
	// - Notification 1: 3 alerts with the same groupKey, timestamp, and pipelineTime
	// - Notification 2: 2 alerts with the same groupKey, timestamp, and pipelineTime
	mockResponse := lokiclient.QueryRes{
		Data: lokiclient.QueryData{
			Result: []lokiclient.Stream{
				{
					Values: []lokiclient.Sample{
						// Notification 1 - Alert 1
						{
							T: entry3Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-1",
								GroupKey:      "groupkey-1",
								Status:        "firing",
								GroupLabels:   map[string]string{"alertname": "alert1"},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "firing",
									Labels: map[string]string{"instance": "host1"},
								},
								AlertIndex:   0,
								AlertCount:   3,
								PipelineTime: pipelineTime,
							}),
						},
						// Notification 1 - Alert 2
						{
							T: entry3Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-1",
								GroupKey:      "groupkey-1",
								Status:        "firing",
								GroupLabels:   map[string]string{"alertname": "alert1"},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "firing",
									Labels: map[string]string{"instance": "host2"},
								},
								AlertIndex:   1,
								AlertCount:   3,
								PipelineTime: pipelineTime,
							}),
						},
						// Notification 1 - Alert 3
						{
							T: entry3Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-1",
								GroupKey:      "groupkey-1",
								Status:        "firing",
								GroupLabels:   map[string]string{"alertname": "alert1"},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "firing",
									Labels: map[string]string{"instance": "host3"},
								},
								AlertIndex:   2,
								AlertCount:   3,
								PipelineTime: pipelineTime,
							}),
						},
						// Notification 2 - Alert 1
						{
							T: entry2Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-2",
								GroupKey:      "groupkey-2",
								Status:        "resolved",
								GroupLabels:   map[string]string{"alertname": "alert2"},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "resolved",
									Labels: map[string]string{"instance": "host1"},
								},
								AlertIndex:   0,
								AlertCount:   2,
								PipelineTime: pipelineTime,
							}),
						},
						// Notification 2 - Alert 2
						{
							T: entry2Time,
							V: createLokiEntryJSON(t, historian.NotificationHistoryLokiEntry{
								SchemaVersion: 1,
								Receiver:      "receiver-2",
								GroupKey:      "groupkey-2",
								Status:        "resolved",
								GroupLabels:   map[string]string{"alertname": "alert2"},
								Alert: historian.NotificationHistoryLokiEntryAlert{
									Status: "resolved",
									Labels: map[string]string{"instance": "host2"},
								},
								AlertIndex:   1,
								AlertCount:   2,
								PipelineTime: pipelineTime,
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

	// Should get 2 notifications (grouped from 5 log lines)
	require.Len(t, entries, 2, "should have 2 notifications after grouping")

	mockClient.AssertExpectations(t)

	// Verify first notification (newest first, so entry3Time)
	assert.Equal(t, "receiver-1", entries[0].Receiver)
	assert.Equal(t, "groupkey-1", entries[0].GroupKey)
	assert.Equal(t, entry3Time, entries[0].Timestamp)
	assert.Len(t, entries[0].Alerts, 3, "first notification should have 3 alerts")
	assert.Equal(t, "host1", entries[0].Alerts[0].Labels["instance"])
	assert.Equal(t, "host2", entries[0].Alerts[1].Labels["instance"])
	assert.Equal(t, "host3", entries[0].Alerts[2].Labels["instance"])

	// Verify second notification
	assert.Equal(t, "receiver-2", entries[1].Receiver)
	assert.Equal(t, "groupkey-2", entries[1].GroupKey)
	assert.Equal(t, entry2Time, entries[1].Timestamp)
	assert.Len(t, entries[1].Alerts, 2, "second notification should have 2 alerts")
	assert.Equal(t, "host1", entries[1].Alerts[0].Labels["instance"])
	assert.Equal(t, "host2", entries[1].Alerts[1].Labels["instance"])
}
