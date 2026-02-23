package v0alpha1

import (
    "time"
)

#NotificationStatus: "firing" | "resolved" @cog(kind="enum",memberNames="Firing|Resolved")

#NotificationOutcome: "success" | "error" @cog(kind="enum",memberNames="Success|Error")

#NotificationQuery: {
    // From is the starting timestamp for the query.
    from?: time.Time
    // To is the starting timestamp for the query.
    to?: time.Time
    // Limit is the maximum number of entries to return.
    limit?: int64    
    // Receiver optionally filters the entries by receiver title (contact point).
    receiver?: string
    // Status optionally filters the entries to only either firing or resolved.
    status?: #NotificationStatus
    // Outcome optionally filters the entries to only either successful or failed attempts.
    outcome?: #NotificationOutcome
    // RuleUID optionally filters the entries to a specific alert rule.
    ruleUID?: string
    // GroupLabels optionally filters the entries by matching group labels.
    groupLabels?: #Matchers
    // Labels optionally filters the entries by matching alert labels.
    labels?: #Matchers
}

#NotificationQueryResult: {
    entries: [...#NotificationEntry]
}

#NotificationEntry: {
    // Timestamp is the time at which the notification attempt completed.
    timestamp: time.Time
    // Receiver is the receiver (contact point) title.
    receiver: string
    // Status indicates if the notification contains one or more firing alerts.
    status: #NotificationStatus
    // Outcome indicaes if the notificaion attempt was successful or if it failed.
    outcome: #NotificationOutcome
    // GroupLabels are the labels uniquely identifying the alert group within a route.
    groupLabels: [string]: string
    // Alerts are the alerts grouped into the notification.
    alerts: [...#NotificationEntryAlert]
    // Retry indicates if the attempt was a retried attempt.
    retry: bool
    // Error is the message returned by the contact point if delivery failed.
    error?: string
    // Duration is the length of time the notification attempt took in nanoseconds.
    duration: int
    // PipelineTime is the time at which the flush began.
    pipelineTime: time.Time
    // GroupKey uniquely idenifies the dispatcher alert group.
    groupKey: string
}

#NotificationEntryAlert: {
    status: string
    labels: [string]: string
    annotations: [string]: string
    startsAt: time.Time
    endsAt: time.Time
}
