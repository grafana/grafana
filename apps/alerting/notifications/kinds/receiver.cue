package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

receiverv0alpha1: {
	kind:   "Receiver"
	plural: "receivers"
	scope:  "Namespaced"
	schema: {
		spec: v0alpha1.ReceiverSpec
	}
	selectableFields: [
		"spec.title",
	]
}
