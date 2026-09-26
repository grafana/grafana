package v1beta1

ReceiverSpec: {
	title: string
	integrations: [...#Integration]
}

// Fields every integration carries. `variant` is the discriminator: codegen switches on
// a single field, and neither `type` nor `version` is unique on its own because a type
// can have several versions. Deriving it from the two means it cannot drift from them.
#Common: {
	uid?:                   string
	disableResolveMessage?: bool
	type:                   string
	version:                string
	variant?:               "\(type)/\(version)"
}

// One definition per integration type and version, in integration_*.cue.
#Integration:
	#DingdingV1 |
	#DiscordV0mimir1 |
	#DiscordV1 |
	#EmailV0mimir1 |
	#EmailV1 |
	#GooglechatV1 |
	#JiraV0mimir1 |
	#JiraV1 |
	#KafkaV1 |
	#LINEV1 |
	#MqttV1 |
	#OncallV1 |
	#OpsgenieV0mimir1 |
	#OpsgenieV1 |
	#PagerdutyV0mimir1 |
	#PagerdutyV1 |
	#PrometheusAlertmanagerV1 |
	#PushoverV0mimir1 |
	#PushoverV1 |
	#SensugoV1 |
	#SlackV0mimir1 |
	#SlackV1 |
	#SnsV0mimir1 |
	#SnsV1 |
	#TeamsV0mimir1 |
	#TeamsV0mimir2 |
	#TeamsV1 |
	#TelegramV0mimir1 |
	#TelegramV1 |
	#ThreemaV1 |
	#VictoropsV0mimir1 |
	#VictoropsV1 |
	#WebexV0mimir1 |
	#WebexV1 |
	#WebhookV0mimir1 |
	#WebhookV1 |
	#WechatV0mimir1 |
	#WecomV1

// The test route takes one integration in its request body, and codegen does not allow
// a union there, so that route keeps the flat shape.
#IntegrationInput: {
	uid?:                   string
	type:                   string
	version:                string
	disableResolveMessage?: bool
	settings: {
		[string]: _
	}
	secureFields?: [string]: bool
}
