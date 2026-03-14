package tool

import (
	"testing"
	"time"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/stretchr/testify/assert"
)

func TestGenerateNotificationHistorySummary(t *testing.T) {
	tests := []struct {
		name     string
		input    v0alpha1.CreateNotificationqueryResponse
		expected string
	}{
		{
			name:     "empty result",
			input:    v0alpha1.CreateNotificationqueryResponse{},
			expected: "No data in response",
		},
		{
			name: "entries",
			input: v0alpha1.CreateNotificationqueryResponse{
				Entries: []v0alpha1.CreateNotificationqueryNotificationEntry{
					{
						Timestamp: time.Date(2025, 11, 14, 10, 00, 00, 0, time.UTC),
						GroupLabels: map[string]string{
							"alertname": "MyAlert",
							"cluster":   "prod-01",
						},
						Status:           v0alpha1.CreateNotificationqueryNotificationStatusFiring,
						Receiver:         "cp001",
						Integration:      "webhook",
						IntegrationIndex: 0,
						Error:            nil,
					},
					{
						Timestamp: time.Date(2025, 11, 14, 10, 01, 00, 0, time.UTC),
						GroupLabels: map[string]string{
							"alertname": "MyOtherAlert",
							"cluster":   "prod-02",
						},
						Status:           v0alpha1.CreateNotificationqueryNotificationStatusFiring,
						Receiver:         "cp001",
						Integration:      "webhook",
						IntegrationIndex: 0,
						Error:            stringPtr("Internal Server Error"),
					},
					{
						Timestamp: time.Date(2025, 11, 14, 10, 02, 00, 0, time.UTC),
						GroupLabels: map[string]string{
							"alertname": "MyAlert",
							"cluster":   "prod-01",
						},
						Status:           v0alpha1.CreateNotificationqueryNotificationStatusResolved,
						Receiver:         "cp002",
						Integration:      "email",
						IntegrationIndex: 2,
						Error:            nil,
					},
				},
			},
			expected: "" +
				"Found 3 notification attempts (1 failures):\n" +
				"\n" +
				"- Group: MyAlert{cluster=\"prod-01\"}\n" +
				"  Time: 2025-11-14T10:00:00Z\n" +
				"  Status: firing\n" +
				"  Contact Point: \"cp001\" [→ webhook(0): Success]\n" +
				"\n" +
				"- Group: MyOtherAlert{cluster=\"prod-02\"}\n" +
				"  Time: 2025-11-14T10:01:00Z\n" +
				"  Status: firing\n" +
				"  Contact Point: \"cp001\" [→ webhook(0): Failed: \"Internal Server Error\"]\n" +
				"\n" +
				"- Group: MyAlert{cluster=\"prod-01\"}\n" +
				"  Time: 2025-11-14T10:02:00Z\n" +
				"  Status: resolved\n" +
				"  Contact Point: \"cp002\" [→ email(2): Success]\n" +
				"\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, GenerateNotificationHistorySummary(tt.input))
		})
	}
}
func stringPtr(s string) *string {
	return &s
}
