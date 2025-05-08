package v0alpha2

BaseIntegration: {
	uid?:                     string
	disable_resolve_message?: bool
}

#SecretString: string

#RedactedSecret: {
	specified: bool
}

// A string that contain sensitive information.
#Secret: string

AlertmanagerIntegration: BaseIntegration & {
	url:                string
	basicAuthUser?:     string
	basicAuthPassword?: #Secret
}

DingdingIntegration: BaseIntegration & {
	url?:     string
	msgType?: string
	title?:   string
	message?: string
}

DiscordIntegration: BaseIntegration & {
	url:                   #Secret
	title?:                string
	message?:              string
	avatar_url?:           string
	use_discord_username?: bool
}

EmailIntegration: BaseIntegration & {
	addresses: [...string]
	singleEmail?: bool
	message?:     string
	subject?:     string
}

GooglechatIntegration: BaseIntegration & {
	url:      #Secret
	title?:   string
	message?: string
}

JiraIntegration: BaseIntegration & {
	api_url:    string
	project:    string
	issue_type: string

	summary?:     string
	description?: string
	labels?: [...string]
	priority?:            string
	reopen_transition?:   string
	resolve_transition?:  string
	wont_fix_resolution?: string
	reopen_duration?:     string
	dedup_key_field?:     string
	fields?: {}

	user?:      #Secret
	password?:  #Secret
	api_token?: #Secret
}

KafkaIntegration: BaseIntegration & {
	kafkaRestProxy: #Secret
	kafkaTopic:     string

	description?:    string
	details?:        string
	username?:       string
	password?:       #Secret
	apiVersion?:     string
	kafkaClusterId?: string
}

LineIntegration: BaseIntegration & {
	token: #Secret

	title?:       string
	description?: string
}

#TLSConfig: {
	insecureSkipVerify?: bool
	caCertificate?:      #Secret
	clientCertificate?:  #Secret
	clientKey?:          #Secret
}

MqttIntegration: BaseIntegration & {
	brokerUrl?:     string
	clientId?:      string
	topic?:         string
	message?:       string
	messageFormat?: string
	username?:      string
	password?:      #Secret
	qos?:           int64
	retain?:        bool
	tlsConfig?:     #TLSConfig
}

OnCallIntegration: BaseIntegration & {
	url: string

	httpMethod?:                string
	maxAlerts?:                 int64
	authorization_scheme?:      string
	authorization_credentials?: #Secret
	username?:                  string
	password?:                  #Secret
	title?:                     string
	message?:                   string
}

OpsgenieIntegrationResponder: {
	id?:       string
	name?:     string
	username?: string
	type:      string
}

OpsgenieIntegration: BaseIntegration & {
	apiKey: #Secret

	apiUrl?:           string
	message?:          string
	description?:      string
	autoClose?:        bool
	overridePriority?: bool
	sendTagsAs?:       string
	responders?: [...OpsgenieIntegrationResponder]
}

PagerdutyIntegration: BaseIntegration & {
	integrationKey: #Secret

	severity?:   string
	class?:      string
	component?:  string
	group?:      string
	summary?:    string
	source?:     string
	client?:     string
	client_url?: string
	details?: {[string]: string}
	url?: string
}

PushoverIntegration: BaseIntegration & {
	userKey:  #Secret
	apiToken: #Secret

	priority?:    int64
	okPriority?:  int64
	retry?:       int64
	expire?:      int64
	device?:      string
	sound?:       string
	okSound?:     string
	title?:       string
	message?:     string
	uploadImage?: bool
}

SensugoIntegration: BaseIntegration & {
	url:    string
	apikey: #Secret

	entity?:    string
	check?:     string
	namespace?: string
	handler?:   string
	message?:   string
}

#SigV4Config: {
	region?:     string
	access_key?: #Secret
	secret_key?: #Secret
	profile?:    string
	role_arn?:   string
}

SnsIntegration: BaseIntegration & {
	api_url?:      string
	sigv4:         #SigV4Config
	topic_arn?:    string
	phone_number?: string
	target_arn?:   string
	subject?:      string
	message?:      string
	attributes?: {[string]: string}
}

SlackIntegration: BaseIntegration & {
	endpointUrl?:    string
	url?:            #Secret
	token?:          #Secret
	recipient?:      string
	text?:           string
	title?:          string
	username?:       string
	icon_emoji?:     string
	icon_url?:       string
	mentionChannel?: string
	mentionUsers?:   string
	mentionGroups?:  string
	color?:          string
}

TelegramIntegration: BaseIntegration & {
	bottoken:          #Secret
	chatid:            string
	message_thread_id: string

	message?:                  string
	parse_mode?:               string
	disable_web_page_preview?: bool
	protect_content?:          bool
	disable_notifications?:    bool
}

TeamsIntegration: BaseIntegration & {
	url: #Secret

	message?:      string
	title?:        string
	sectiontitle?: string
}

ThreemaIntegration: BaseIntegration & {
	gateway_id:   string
	recipient_id: string
	api_secret:   #Secret

	title?:       string
	description?: string
}

VictoropsIntegration: BaseIntegration & {
	url: #Secret

	messageType?: string
	title?:       string
	description?: string
}

WebexIntegration: BaseIntegration & {
	bot_token: #Secret

	api_url?: string
	message?: string
	room_id?: string
}

#CustomPayload: {
	template?: string
	vars?: {[string]: string}
}

#HMACConfig: {
	secret?:         #Secret
	header:          string
	timestampHeader: string
}

WebhookIntegration: BaseIntegration & {
	url: string

	httpMethod?:                string
	maxAlerts?:                 int64
	authorization_scheme?:      string
	authorization_credentials?: #Secret
	username?:                  string
	password?:                  #Secret
	headers?: {[string]: string}
	title?:      string
	message?:    string
	tlsConfig?:  #TLSConfig
	hmacConfig?: #HMACConfig
	payload?:    #CustomPayload
}

WecomIntegration: BaseIntegration & {
	endpointUrl?: string
	url?:         #Secret
	secret?:      #Secret
	agent_id?:    string
	corp_id?:     string
	message?:     string
	title?:       string
	msgtype?:     string
	touser?:      string
}

ReceiverSpec: {
	title: string
	integrations: {
		alertmanager?: [...AlertmanagerIntegration]
		dingding?: [...DingdingIntegration]
		discord?: [...DiscordIntegration]
		email?: [...EmailIntegration]
		googlechat?: [...GooglechatIntegration]
		jira?: [...JiraIntegration]
		kafka?: [...KafkaIntegration]
		line?: [...LineIntegration]
		mqtt?: [...MqttIntegration]
		opsgenie?: [...OpsgenieIntegration]
		pagerduty?: [...PagerdutyIntegration]
		oncall?: [...OnCallIntegration]
		pushover?: [...PushoverIntegration]
		sensugo?: [...SensugoIntegration]
		slack?: [...SlackIntegration]
		sns?: [...SnsIntegration]
		teams?: [...TeamsIntegration]
		telegram?: [...TelegramIntegration]
		threema?: [...ThreemaIntegration]
		victorops?: [...VictoropsIntegration]
		webhook?: [...WebhookIntegration]
		wecom?: [...WecomIntegration]
		webex?: [...WebexIntegration]
	}
}
