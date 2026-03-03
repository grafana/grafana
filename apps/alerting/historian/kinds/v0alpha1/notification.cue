package v0alpha1

import (
    "time"
)

#NotificationStatus: "firing" | "resolved" @cog(kind="enum",memberNames="Firing|Resolved")

#NotificationOutcome: "success" | "error" @cog(kind="enum",memberNames="Success|Error")

#NotificationQuery: {
    // Type of query to perform (default: entries)
    type?: "entries" | "counts" @cog(kind="enum",memberNames="Entries|Counts")

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

    // GroupBy specifies how to aggregate counts queries.
    groupBy?: {
        receiver: bool
        integration: bool
        integrationIndex: bool
        status: bool
        outcome: bool
        error: bool
    }
}

#NotificationQueryResult: {
    entries: [...#NotificationEntry]
    counts: [...#NotificationCount]
}

#NotificationEntry: {
    // Timestamp is the time at which the notification attempt completed.
    timestamp: time.Time
    // Uuid is a unique identifier for the notification attempt.
    uuid: string
    // Receiver is the receiver (contact point) title.
    receiver: string
    // Integration is the integration (contact point type) name.
    integration: string
    // IntegrationIndex is the index of the integration within the receiver.
    integrationIndex: int
    // Status indicates if the notification contains one or more firing alerts.
    status: #NotificationStatus
    // Outcome indicaes if the notificaion attempt was successful or if it failed.
    outcome: #NotificationOutcome
    // GroupLabels are the labels uniquely identifying the alert group within a route.
    groupLabels: [string]: string
    // RuleUIDs are the unique identifiers of the alert rules included in the notification.
    ruleUIDs: [...string]
    // AlertCount is the total number of alerts included in the notification.
    alertCount: int
    // Alerts are the alerts grouped into the notification. Deprecated: not populated, will be removed.
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

#NotificationCount: {
    receiver?: string
    integration?: string
    integrationIndex?: int
    status?: #NotificationStatus
    outcome?: #NotificationOutcome
    error?: string

    // Count is the number of notification attempts in the time period.
    count: int
}

#AlertQuery: {
    // From is the starting timestamp for the query.
    from?: time.Time
    // To is the ending timestamp for the query.
    to?: time.Time
    // UUID filters the alerts to those belonging to a specific alert rule.
    uuid?: string
    // Limit is the maximum number of entries to return.
    limit?: int64
}

#AlertQueryResult: {
    alerts: [...#NotificationEntryAlert]
}

#NotificationEntryAlert: {
    status: string
    labels: [string]: string
    annotations: [string]: string
    startsAt: time.Time
    endsAt: time.Time
    enrichments?: _
}
