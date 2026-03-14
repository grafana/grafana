package tool

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
)

// GenerateNotificationHistorySummary creates a natural language summary of the result from a notification history query.
func GenerateNotificationHistorySummary(res v0alpha1.CreateNotificationqueryResponse) string {

	switch {
	case res.Entries != nil:
		return generateEntriesSummary(res.Entries)
	case res.Counts != nil:
		return generateCountsSummary(res.Counts)
	default:
		return "No data in response"
	}
}

func generateEntriesSummary(entries []v0alpha1.CreateNotificationqueryNotificationEntry) string {
	var summary strings.Builder

	if len(entries) == 0 {
		summary.WriteString("No notification attempts found.")
		return summary.String()
	}

	errorCount := 0
	for _, entry := range entries {
		if entry.Error != nil && *entry.Error != "" {
			errorCount++
		}
	}

	fmt.Fprintf(&summary, "Found %d notification attempts (%d failures):\n\n", len(entries), errorCount)

	displayCount := len(entries)
	if displayCount > 20 {
		displayCount = 20
	}

	for i := 0; i < displayCount; i++ {
		e := entries[i]

		groupLabelsStr := formatGroupLabels(e.GroupLabels)

		outcomeStr := "Success"
		if e.Error != nil && *e.Error != "" {
			outcomeStr = fmt.Sprintf("Failed: %q", *e.Error)
		}

		fmt.Fprintf(&summary, "- Group: %s\n", groupLabelsStr)
		fmt.Fprintf(&summary, "  Time: %s\n", e.Timestamp.Format(time.RFC3339))
		fmt.Fprintf(&summary, "  Status: %s\n", e.Status)
		fmt.Fprintf(&summary, "  Contact Point: %q [→ %s(%d): %s]\n",
			e.Receiver, e.Integration, e.IntegrationIndex, outcomeStr)
		fmt.Fprintf(&summary, "\n")
	}

	if len(entries) > displayCount {
		fmt.Fprintf(&summary, "... and %d more\n", len(entries)-displayCount)
	}

	return summary.String()
}

// generateHistoryCountsSummary creates a summary for the get_notification_history count operation.
func generateCountsSummary(counts []v0alpha1.CreateNotificationqueryNotificationCount) string {
	var summary strings.Builder

	if len(counts) == 0 {
		fmt.Fprintf(&summary, "No notification attempts found.")
		return summary.String()
	}

	fmt.Fprintf(&summary, "Number of notification attempts:\n\n")

	displayCount := len(counts)
	if displayCount > 10 {
		displayCount = 10
	}

	for i := 0; i < displayCount; i++ {
		c := counts[i]

		groupStrs := []string{}
		if c.Receiver != nil {
			groupStrs = append(groupStrs, *c.Receiver)
		}
		if c.Integration != nil {
			groupStrs = append(groupStrs, *c.Integration)
		}
		if c.Status != nil {
			groupStrs = append(groupStrs, string(*c.Status))
		}
		if c.Outcome != nil {
			groupStrs = append(groupStrs, string(*c.Outcome))
		}
		if c.Error != nil {
			groupStrs = append(groupStrs, *c.Error)
		}

		fmt.Fprintf(&summary, "- [%s] %d\n",
			strings.Join(groupStrs, "|"), int(c.Count))

	}

	if len(counts) > displayCount {
		fmt.Fprintf(&summary, "... %d more\n", len(counts)-displayCount)
	}

	return summary.String()
}

// formatGroupLabels formats group labels in the form: AlertName{l1="v1",l2="v2"}
func formatGroupLabels(groupLabels map[string]string) string {
	alertName := ""
	otherLabels := make([]string, 0, len(groupLabels))
	for k, v := range groupLabels {
		if k == "alertname" {
			alertName = v
		} else {
			otherLabels = append(otherLabels, fmt.Sprintf("%s=%q", k, v))
		}
	}

	sort.Strings(otherLabels)

	return fmt.Sprintf("%s{%s}", alertName, strings.Join(otherLabels, ","))
}
