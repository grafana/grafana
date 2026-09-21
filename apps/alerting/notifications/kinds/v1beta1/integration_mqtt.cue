package v1beta1

// MQTT integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#MqttV1: {
	#Common
	type:    "mqtt"
	version: "v1"
	settings: {
		brokerUrl:      string
		topic:          string
		messageFormat?: "json" | "text"
		clientId?:      string
		message?:       string
		username?:      string
		qos?:           "0" | "1" | "2"
		retain?:        bool
		tlsConfig?:     #GrafanaTLSConfig
	}
	secureFields?: {
		password?:                      bool
		"tlsConfig.caCertificate"?:     bool
		"tlsConfig.clientCertificate"?: bool
		"tlsConfig.clientKey"?:         bool
	}
}
