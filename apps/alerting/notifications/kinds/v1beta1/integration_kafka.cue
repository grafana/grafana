package v1beta1

// Kafka REST Proxy integrations.
// Generated from the schema registry in github.com/grafana/alerting - do not edit by hand.

#KafkaV1: {
	#Common
	type:    "kafka"
	version: "v1"
	settings: {
		kafkaRestProxy: string
		kafkaTopic:     string
		username?:      string
		apiVersion?:    "v2" | "v3"
		kafkaClusterId: string
		description?:   string
		details?:       string
	}
	secureFields?: {
		password?: bool
	}
}
