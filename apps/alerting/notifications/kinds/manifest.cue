package kinds

import (
	"time",
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

#Alert: {
	labels: {
		[string]: string
	}
	annotations: {
		[string]: string
	}
}

manifest: {
	appName:       "alerting-notifications"
	groupOverride: "notifications.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				receiverv0alpha1,
				routeTreev0alpha1,
				templatev0alpha1,
				timeIntervalv0alpha1,
			],
			routes: {
				namespaced: {
					"/testing/integration" : {
						"GET": {
							name: "getIntegrationTest"
							request: {
								body: {
										alert: #Alert
										receiver_ref?: string
										integration: v0alpha1.#Integration
								}
							}
							response: {
									timestamp: time.Time
									duration: string
									error?: string
							}
						}
					}
				}
			},
		}
	}
}
