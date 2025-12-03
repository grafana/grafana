package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
)

receiverKind: {
	kind: "Receiver"
	pluralName: "Receivers"
}

receiverv0alpha1: receiverKind & {
	schema: {
		spec: v0alpha1.ReceiverSpec
	}
	selectableFields: [
		"spec.title",
	]
}
