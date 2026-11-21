package kinds

import (
	"github.com/grafana/grafana/apps/alerting/alertenrichment/kinds/v1beta1"
)

alertEnrichmentKind: {
	kind:       "AlertEnrichment"
	pluralName: "AlertEnrichments"
	scope:      "Namespaced"
}

alertEnrichmentv1beta1: alertEnrichmentKind & {
	schema: {
		spec: v1beta1.#AlertEnrichmentSpec
	}
}
