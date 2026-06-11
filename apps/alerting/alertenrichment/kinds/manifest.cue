package kinds

import (
	"github.com/grafana/grafana/apps/alerting/alertenrichment/kinds/v1beta1"
)

manifest: {
	appName:          "alertenrichment"
	groupOverride:    "alertenrichment.grafana.app"
	preferredVersion: "v1beta1"
	versions: {
		"v1beta1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				alertEnrichmentv1beta1,
			]
		}
	}
	roles: {}
}

alertEnrichmentKind: {
	kind:       "AlertEnrichment"
	pluralName: "AlertEnrichments"
}

alertEnrichmentv1beta1: alertEnrichmentKind & {
	schema: {
		spec: v1beta1.AlertEnrichmentSpec
	}
}
