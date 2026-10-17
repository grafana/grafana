package v1beta1

// Alertmanager integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#PrometheusAlertmanagerV1: {
	#Common
	type:    "prometheus-alertmanager"
	version: "v1"
	settings: {
		url:            string
		basicAuthUser?: string
	}
	secureFields?: {
		basicAuthPassword?: bool
	}
}
