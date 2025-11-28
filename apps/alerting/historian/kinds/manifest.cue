package kinds

manifest: {
	appName:       "alerting-historian"
	groupOverride: "historian.alerting.grafana.app"
	versions: {
		"v0alpha1": v0alpha1
	}
}

v0alpha1: {
    kinds: [dummyv0alpha1]

    routes: {
        namespaced: {
            // This endpoint is an exact copy of the existing /history endpoint,
            // with the exception that error responses will be Kubernetes-style,
            // not Grafana-style. It will be replaced in the future with a better
            // more schema-friendly API.
            "/alertstate/history": {
                "GET": {
                    response: {
                      body: [string]: _
                    }
                    responseMetadata: typeMeta: false
                }
            }

            "/notification/query": {
                "POST": {
                    request: {
                        body: #NotificationQuery
                    }
                    response: {
                        body: #NotificationQueryResult
                    }
                    responseMetadata: typeMeta: false                
                }
            }
        }
    }
}

#NotificationStatus: "firing" | "resolved" @cog(kind="enum",memberNames="Firing|Resolved")
#NotificationOutcome: "success" | "error" @cog(kind="enum",memberNames="Success|Error")

#NotificationQuery: {
    from?: int64 // RFC3339Nano
    to?: int64 // RFC3339Nano
    limit?: int64
    receiver?: string
    status?: #NotificationStatus
    outcome?: #NotificationOutcome
    ruleUID?: string
}

#NotificationQueryResult: {
    entries: [...#NotificationEntry]
}

#NotificationEntry: {
    timestamp: int64 // RFC3339Nano
    receiver: string
    status: #NotificationStatus
    outcome: #NotificationOutcome
    groupLabels: [string]: string
    alerts: [...#NotificationEntryAlert]
    retry: bool
    error?: string
    duration: int64
    pipelineTime: int64
}

#NotificationEntryAlert: {
    status: string
    labels: [string]: string
    annotations: [string]: string
    startsAt: int64
    endsAt: int64
}

dummyv0alpha1: {
    kind: "Dummy"
    schema: {
        // Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
        spec: {
            dummyField: int
        }
    }
}