package v0alpha1

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

		// Query notification history.
		"/notification/query": {
			"POST": {
				request: {
					body: #NotificationQuery
				}
				response: #NotificationQueryResult
				responseMetadata: typeMeta: false				
			}
		}
	}
}