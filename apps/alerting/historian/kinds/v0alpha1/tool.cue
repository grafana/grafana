package v0alpha1

import (
    "time"
)

#ToolInput: {
	// Operation specifies the the sub-tool to invoke.
	operation: "get_alert_state_history" | "get_notification_history" @cog(kind="enum",memberNames="GetAlertStateHistory|GetNotificationHistory")

	// RuleUID specifies a specific alert rule UID to get history for.
	ruleUID?: string
	// Type of query to perform (default: entries)
        type?: "entries" | "counts" @cog(kind="enum",memberNames="Entries|Counts")
	// From is the starting timestamp for the query.
	from?: time.Time
	// To is the starting timestamp for the query.
	to?: time.Time
	// Limit is the maximum number of entries to return.
	limit?: int64

	// GetAlertStateHistory holds get_alert_state_history operation specific options.
        get_alert_state_history?: {
		// State optionally filters alert state transition
 		type?: "normal" | "pending" | "alerting" | "nodata" | "error" @cog(kind="enum",memberNames="Normal|Pending|Alerting|NoData|Error")
	}

	// GetNotificationHistory holds get_notification_history operation specific options
        get_notification_history?: {
		// Receiver optionally filters the entries by receiver title (contact point).
		receiver?: string
		// Status optionally filters the entries to only either firing or resolved.
		status?: "firing" | "resolved" @cog(kind="enum",memberNames="Firing|Resolved")
		// Outcome optionally filters the entries to only either successful or failed attempts.
		outcome?: "success" | "failure" @cog(kind="enum",memberNames="Success|Failure")
		// GroupLabels optionally filters the entries by matching group labels.
		groupLabels?: #Matchers
		// Labels optionally filters the entries by matching alert labels.
	       labels?: #Matchers
	}
}

#ToolOutput: {
	// Summary is a natural language summary of the operation result.
	summary: string
}
