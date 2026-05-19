package kinds

import (
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/kinds/v1beta1"
)

receiverKind: {
	kind:       "Receiver"
	pluralName: "Receivers"
}

receiverv0alpha1: receiverKind & {
	schema: {
		spec: v0alpha1.ReceiverSpec
	}
	selectableFields: [
		"spec.title",
	]
	routes: {
		"test": {
			"POST": {
				name: "createReceiverIntegrationTest"
				request: {
					body: CreateReceiverTestRequestBody
				}
				response: CreateReceiverTestResponse
				responseMetadata: {
					typeMeta: true
				}
			}
		}
	}
}

receiverv1beta1: receiverKind & {
	schema: {
		spec: v1beta1.ReceiverSpec
	}
	selectableFields: [
		"spec.title",
	]
	routes: {
		"test": {
			"POST": {
				name: "createReceiverIntegrationTest"
				request: {
					body: CreateReceiverTestRequestBodyV1beta1
				}
				response: CreateReceiverTestResponse
				responseMetadata: {
					typeMeta: true
				}
			}
		}
	}
}

#Alert: {
	labels: {
		[string]: string
	}
	annotations: {
		[string]: string
	}
}

CreateReceiverTestRequestBody: {
	integration: v0alpha1.#Integration
	alert:       #Alert
}

CreateReceiverTestRequestBodyV1beta1: {
	integration: v1beta1.#Integration
	alert:       #Alert
}

CreateReceiverTestResponse: {
	status:   "success" | "failure"
	duration: string
	error?:   string
}
