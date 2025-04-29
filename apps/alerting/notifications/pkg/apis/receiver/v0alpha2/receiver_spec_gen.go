// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha2

// +k8s:openapi-gen=true
type AlertmanagerIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   string  `json:"url"`
	BasicAuthUser         *string `json:"basicAuthUser,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	BasicAuthPassword     *Secret `json:"basicAuthPassword,omitempty"`
}

// NewAlertmanagerIntegration creates a new AlertmanagerIntegration object.
func NewAlertmanagerIntegration() *AlertmanagerIntegration {
	return &AlertmanagerIntegration{}
}

// A string that contain sensitive information.
// +k8s:openapi-gen=true
type Secret string

// +k8s:openapi-gen=true
type DingdingIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   *string `json:"url,omitempty"`
	MsgType               *string `json:"msgType,omitempty"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Message               *string `json:"message,omitempty"`
}

// NewDingdingIntegration creates a new DingdingIntegration object.
func NewDingdingIntegration() *DingdingIntegration {
	return &DingdingIntegration{}
}

// +k8s:openapi-gen=true
type DiscordIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   Secret  `json:"url"`
	Title                 *string `json:"title,omitempty"`
	Message               *string `json:"message,omitempty"`
	AvatarUrl             *string `json:"avatar_url,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	UseDiscordUsername    *bool   `json:"use_discord_username,omitempty"`
}

// NewDiscordIntegration creates a new DiscordIntegration object.
func NewDiscordIntegration() *DiscordIntegration {
	return &DiscordIntegration{}
}

// +k8s:openapi-gen=true
type EmailIntegration struct {
	Uid                   *string  `json:"uid,omitempty"`
	Addresses             []string `json:"addresses"`
	SingleEmail           *bool    `json:"singleEmail,omitempty"`
	Message               *string  `json:"message,omitempty"`
	DisableResolveMessage *bool    `json:"disable_resolve_message,omitempty"`
	Subject               *string  `json:"subject,omitempty"`
}

// NewEmailIntegration creates a new EmailIntegration object.
func NewEmailIntegration() *EmailIntegration {
	return &EmailIntegration{}
}

// +k8s:openapi-gen=true
type GooglechatIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   Secret  `json:"url"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Message               *string `json:"message,omitempty"`
}

// NewGooglechatIntegration creates a new GooglechatIntegration object.
func NewGooglechatIntegration() *GooglechatIntegration {
	return &GooglechatIntegration{}
}

// +k8s:openapi-gen=true
type JiraIntegration struct {
	Uid                   *string     `json:"uid,omitempty"`
	ApiUrl                string      `json:"api_url"`
	Project               string      `json:"project"`
	IssueType             string      `json:"issue_type"`
	Summary               *string     `json:"summary,omitempty"`
	Description           *string     `json:"description,omitempty"`
	Labels                []string    `json:"labels,omitempty"`
	Priority              *string     `json:"priority,omitempty"`
	ReopenTransition      *string     `json:"reopen_transition,omitempty"`
	ResolveTransition     *string     `json:"resolve_transition,omitempty"`
	WontFixResolution     *string     `json:"wont_fix_resolution,omitempty"`
	ReopenDuration        *string     `json:"reopen_duration,omitempty"`
	DedupKeyField         *string     `json:"dedup_key_field,omitempty"`
	Fields                interface{} `json:"fields,omitempty"`
	User                  *Secret     `json:"user,omitempty"`
	Password              *Secret     `json:"password,omitempty"`
	DisableResolveMessage *bool       `json:"disable_resolve_message,omitempty"`
	ApiToken              *Secret     `json:"api_token,omitempty"`
}

// NewJiraIntegration creates a new JiraIntegration object.
func NewJiraIntegration() *JiraIntegration {
	return &JiraIntegration{}
}

// +k8s:openapi-gen=true
type KafkaIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	KafkaRestProxy        Secret  `json:"kafkaRestProxy"`
	KafkaTopic            string  `json:"kafkaTopic"`
	Description           *string `json:"description,omitempty"`
	Details               *string `json:"details,omitempty"`
	Username              *string `json:"username,omitempty"`
	Password              *Secret `json:"password,omitempty"`
	ApiVersion            *string `json:"apiVersion,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	KafkaClusterId        *string `json:"kafkaClusterId,omitempty"`
}

// NewKafkaIntegration creates a new KafkaIntegration object.
func NewKafkaIntegration() *KafkaIntegration {
	return &KafkaIntegration{}
}

// +k8s:openapi-gen=true
type LineIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Token                 Secret  `json:"token"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Description           *string `json:"description,omitempty"`
}

// NewLineIntegration creates a new LineIntegration object.
func NewLineIntegration() *LineIntegration {
	return &LineIntegration{}
}

// +k8s:openapi-gen=true
type MqttIntegration struct {
	Uid                   *string    `json:"uid,omitempty"`
	BrokerUrl             *string    `json:"brokerUrl,omitempty"`
	ClientId              *string    `json:"clientId,omitempty"`
	Topic                 *string    `json:"topic,omitempty"`
	Message               *string    `json:"message,omitempty"`
	MessageFormat         *string    `json:"messageFormat,omitempty"`
	Username              *string    `json:"username,omitempty"`
	Password              *Secret    `json:"password,omitempty"`
	Qos                   *int64     `json:"qos,omitempty"`
	Retain                *bool      `json:"retain,omitempty"`
	DisableResolveMessage *bool      `json:"disable_resolve_message,omitempty"`
	TlsConfig             *TLSConfig `json:"tlsConfig,omitempty"`
}

// NewMqttIntegration creates a new MqttIntegration object.
func NewMqttIntegration() *MqttIntegration {
	return &MqttIntegration{}
}

// +k8s:openapi-gen=true
type TLSConfig struct {
	InsecureSkipVerify *bool   `json:"insecureSkipVerify,omitempty"`
	CaCertificate      *Secret `json:"caCertificate,omitempty"`
	ClientCertificate  *Secret `json:"clientCertificate,omitempty"`
	ClientKey          *Secret `json:"clientKey,omitempty"`
}

// NewTLSConfig creates a new TLSConfig object.
func NewTLSConfig() *TLSConfig {
	return &TLSConfig{}
}

// +k8s:openapi-gen=true
type OpsgenieIntegration struct {
	Uid                   *string                        `json:"uid,omitempty"`
	ApiKey                Secret                         `json:"apiKey"`
	ApiUrl                *string                        `json:"apiUrl,omitempty"`
	Message               *string                        `json:"message,omitempty"`
	Description           *string                        `json:"description,omitempty"`
	AutoClose             *bool                          `json:"autoClose,omitempty"`
	OverridePriority      *bool                          `json:"overridePriority,omitempty"`
	SendTagsAs            *string                        `json:"sendTagsAs,omitempty"`
	DisableResolveMessage *bool                          `json:"disable_resolve_message,omitempty"`
	Responders            []OpsgenieIntegrationResponder `json:"responders,omitempty"`
}

// NewOpsgenieIntegration creates a new OpsgenieIntegration object.
func NewOpsgenieIntegration() *OpsgenieIntegration {
	return &OpsgenieIntegration{}
}

// +k8s:openapi-gen=true
type OpsgenieIntegrationResponder struct {
	Id       *string `json:"id,omitempty"`
	Name     *string `json:"name,omitempty"`
	Username *string `json:"username,omitempty"`
	Type     string  `json:"type"`
}

// NewOpsgenieIntegrationResponder creates a new OpsgenieIntegrationResponder object.
func NewOpsgenieIntegrationResponder() *OpsgenieIntegrationResponder {
	return &OpsgenieIntegrationResponder{}
}

// +k8s:openapi-gen=true
type PagerdutyIntegration struct {
	Uid                   *string           `json:"uid,omitempty"`
	IntegrationKey        Secret            `json:"integrationKey"`
	Severity              *string           `json:"severity,omitempty"`
	Class                 *string           `json:"class,omitempty"`
	Component             *string           `json:"component,omitempty"`
	Group                 *string           `json:"group,omitempty"`
	Summary               *string           `json:"summary,omitempty"`
	Source                *string           `json:"source,omitempty"`
	Client                *string           `json:"client,omitempty"`
	ClientUrl             *string           `json:"client_url,omitempty"`
	Details               map[string]string `json:"details,omitempty"`
	DisableResolveMessage *bool             `json:"disable_resolve_message,omitempty"`
	Url                   *string           `json:"url,omitempty"`
}

// NewPagerdutyIntegration creates a new PagerdutyIntegration object.
func NewPagerdutyIntegration() *PagerdutyIntegration {
	return &PagerdutyIntegration{}
}

// +k8s:openapi-gen=true
type OnCallIntegration struct {
	Uid                      *string `json:"uid,omitempty"`
	Url                      string  `json:"url"`
	HttpMethod               *string `json:"httpMethod,omitempty"`
	MaxAlerts                *int64  `json:"maxAlerts,omitempty"`
	AuthorizationScheme      *string `json:"authorization_scheme,omitempty"`
	AuthorizationCredentials *Secret `json:"authorization_credentials,omitempty"`
	Username                 *string `json:"username,omitempty"`
	Password                 *Secret `json:"password,omitempty"`
	Title                    *string `json:"title,omitempty"`
	DisableResolveMessage    *bool   `json:"disable_resolve_message,omitempty"`
	Message                  *string `json:"message,omitempty"`
}

// NewOnCallIntegration creates a new OnCallIntegration object.
func NewOnCallIntegration() *OnCallIntegration {
	return &OnCallIntegration{}
}

// +k8s:openapi-gen=true
type PushoverIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	UserKey               Secret  `json:"userKey"`
	ApiToken              Secret  `json:"apiToken"`
	Priority              *int64  `json:"priority,omitempty"`
	OkPriority            *int64  `json:"okPriority,omitempty"`
	Retry                 *int64  `json:"retry,omitempty"`
	Expire                *int64  `json:"expire,omitempty"`
	Device                *string `json:"device,omitempty"`
	Sound                 *string `json:"sound,omitempty"`
	OkSound               *string `json:"okSound,omitempty"`
	Title                 *string `json:"title,omitempty"`
	Message               *string `json:"message,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	UploadImage           *bool   `json:"uploadImage,omitempty"`
}

// NewPushoverIntegration creates a new PushoverIntegration object.
func NewPushoverIntegration() *PushoverIntegration {
	return &PushoverIntegration{}
}

// +k8s:openapi-gen=true
type SensugoIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   string  `json:"url"`
	Apikey                Secret  `json:"apikey"`
	Entity                *string `json:"entity,omitempty"`
	Check                 *string `json:"check,omitempty"`
	Namespace             *string `json:"namespace,omitempty"`
	Handler               *string `json:"handler,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Message               *string `json:"message,omitempty"`
}

// NewSensugoIntegration creates a new SensugoIntegration object.
func NewSensugoIntegration() *SensugoIntegration {
	return &SensugoIntegration{}
}

// +k8s:openapi-gen=true
type SlackIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	EndpointUrl           *string `json:"endpointUrl,omitempty"`
	Url                   *Secret `json:"url,omitempty"`
	Token                 *Secret `json:"token,omitempty"`
	Recipient             *string `json:"recipient,omitempty"`
	Text                  *string `json:"text,omitempty"`
	Title                 *string `json:"title,omitempty"`
	Username              *string `json:"username,omitempty"`
	IconEmoji             *string `json:"icon_emoji,omitempty"`
	IconUrl               *string `json:"icon_url,omitempty"`
	MentionChannel        *string `json:"mentionChannel,omitempty"`
	MentionUsers          *string `json:"mentionUsers,omitempty"`
	MentionGroups         *string `json:"mentionGroups,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Color                 *string `json:"color,omitempty"`
}

// NewSlackIntegration creates a new SlackIntegration object.
func NewSlackIntegration() *SlackIntegration {
	return &SlackIntegration{}
}

// +k8s:openapi-gen=true
type SnsIntegration struct {
	Uid                   *string           `json:"uid,omitempty"`
	ApiUrl                *string           `json:"api_url,omitempty"`
	Sigv4                 SigV4Config       `json:"sigv4"`
	TopicArn              *string           `json:"topic_arn,omitempty"`
	PhoneNumber           *string           `json:"phone_number,omitempty"`
	TargetArn             *string           `json:"target_arn,omitempty"`
	Subject               *string           `json:"subject,omitempty"`
	Message               *string           `json:"message,omitempty"`
	DisableResolveMessage *bool             `json:"disable_resolve_message,omitempty"`
	Attributes            map[string]string `json:"attributes,omitempty"`
}

// NewSnsIntegration creates a new SnsIntegration object.
func NewSnsIntegration() *SnsIntegration {
	return &SnsIntegration{
		Sigv4: *NewSigV4Config(),
	}
}

// +k8s:openapi-gen=true
type SigV4Config struct {
	Region    *string `json:"region,omitempty"`
	AccessKey *Secret `json:"access_key,omitempty"`
	SecretKey *Secret `json:"secret_key,omitempty"`
	Profile   *string `json:"profile,omitempty"`
	RoleArn   *string `json:"role_arn,omitempty"`
}

// NewSigV4Config creates a new SigV4Config object.
func NewSigV4Config() *SigV4Config {
	return &SigV4Config{}
}

// +k8s:openapi-gen=true
type TeamsIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   Secret  `json:"url"`
	Message               *string `json:"message,omitempty"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Sectiontitle          *string `json:"sectiontitle,omitempty"`
}

// NewTeamsIntegration creates a new TeamsIntegration object.
func NewTeamsIntegration() *TeamsIntegration {
	return &TeamsIntegration{}
}

// +k8s:openapi-gen=true
type TelegramIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Bottoken              Secret  `json:"bottoken"`
	Chatid                string  `json:"chatid"`
	MessageThreadId       string  `json:"message_thread_id"`
	Message               *string `json:"message,omitempty"`
	ParseMode             *string `json:"parse_mode,omitempty"`
	DisableWebPagePreview *bool   `json:"disable_web_page_preview,omitempty"`
	ProtectContent        *bool   `json:"protect_content,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	DisableNotifications  *bool   `json:"disable_notifications,omitempty"`
}

// NewTelegramIntegration creates a new TelegramIntegration object.
func NewTelegramIntegration() *TelegramIntegration {
	return &TelegramIntegration{}
}

// +k8s:openapi-gen=true
type ThreemaIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	GatewayId             string  `json:"gateway_id"`
	RecipientId           string  `json:"recipient_id"`
	ApiSecret             Secret  `json:"api_secret"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Description           *string `json:"description,omitempty"`
}

// NewThreemaIntegration creates a new ThreemaIntegration object.
func NewThreemaIntegration() *ThreemaIntegration {
	return &ThreemaIntegration{}
}

// +k8s:openapi-gen=true
type VictoropsIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	Url                   Secret  `json:"url"`
	MessageType           *string `json:"messageType,omitempty"`
	Title                 *string `json:"title,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Description           *string `json:"description,omitempty"`
}

// NewVictoropsIntegration creates a new VictoropsIntegration object.
func NewVictoropsIntegration() *VictoropsIntegration {
	return &VictoropsIntegration{}
}

// +k8s:openapi-gen=true
type WebhookIntegration struct {
	Uid                      *string           `json:"uid,omitempty"`
	Url                      string            `json:"url"`
	HttpMethod               *string           `json:"httpMethod,omitempty"`
	MaxAlerts                *int64            `json:"maxAlerts,omitempty"`
	AuthorizationScheme      *string           `json:"authorization_scheme,omitempty"`
	AuthorizationCredentials *Secret           `json:"authorization_credentials,omitempty"`
	Username                 *string           `json:"username,omitempty"`
	Password                 *Secret           `json:"password,omitempty"`
	Headers                  map[string]string `json:"headers,omitempty"`
	Title                    *string           `json:"title,omitempty"`
	Message                  *string           `json:"message,omitempty"`
	TlsConfig                *TLSConfig        `json:"tlsConfig,omitempty"`
	HmacConfig               *HMACConfig       `json:"hmacConfig,omitempty"`
	DisableResolveMessage    *bool             `json:"disable_resolve_message,omitempty"`
	Payload                  *CustomPayload    `json:"payload,omitempty"`
}

// NewWebhookIntegration creates a new WebhookIntegration object.
func NewWebhookIntegration() *WebhookIntegration {
	return &WebhookIntegration{}
}

// +k8s:openapi-gen=true
type HMACConfig struct {
	Secret          *Secret `json:"secret,omitempty"`
	Header          string  `json:"header"`
	TimestampHeader string  `json:"timestampHeader"`
}

// NewHMACConfig creates a new HMACConfig object.
func NewHMACConfig() *HMACConfig {
	return &HMACConfig{}
}

// +k8s:openapi-gen=true
type CustomPayload struct {
	Template *string           `json:"template,omitempty"`
	Vars     map[string]string `json:"vars,omitempty"`
}

// NewCustomPayload creates a new CustomPayload object.
func NewCustomPayload() *CustomPayload {
	return &CustomPayload{}
}

// +k8s:openapi-gen=true
type WecomIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	EndpointUrl           *string `json:"endpointUrl,omitempty"`
	Url                   *Secret `json:"url,omitempty"`
	Secret                *Secret `json:"secret,omitempty"`
	AgentId               *string `json:"agent_id,omitempty"`
	CorpId                *string `json:"corp_id,omitempty"`
	Message               *string `json:"message,omitempty"`
	Title                 *string `json:"title,omitempty"`
	Msgtype               *string `json:"msgtype,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	Touser                *string `json:"touser,omitempty"`
}

// NewWecomIntegration creates a new WecomIntegration object.
func NewWecomIntegration() *WecomIntegration {
	return &WecomIntegration{}
}

// +k8s:openapi-gen=true
type WebexIntegration struct {
	Uid                   *string `json:"uid,omitempty"`
	BotToken              Secret  `json:"bot_token"`
	ApiUrl                *string `json:"api_url,omitempty"`
	Message               *string `json:"message,omitempty"`
	DisableResolveMessage *bool   `json:"disable_resolve_message,omitempty"`
	RoomId                *string `json:"room_id,omitempty"`
}

// NewWebexIntegration creates a new WebexIntegration object.
func NewWebexIntegration() *WebexIntegration {
	return &WebexIntegration{}
}

// +k8s:openapi-gen=true
type Spec struct {
	Title        string                   `json:"title"`
	Integrations V0alpha2SpecIntegrations `json:"integrations"`
}

// NewSpec creates a new Spec object.
func NewSpec() *Spec {
	return &Spec{
		Integrations: *NewV0alpha2SpecIntegrations(),
	}
}

// +k8s:openapi-gen=true
type V0alpha2SpecIntegrations struct {
	Alertmanager []AlertmanagerIntegration `json:"alertmanager,omitempty"`
	Dingding     []DingdingIntegration     `json:"dingding,omitempty"`
	Discord      []DiscordIntegration      `json:"discord,omitempty"`
	Email        []EmailIntegration        `json:"email,omitempty"`
	Googlechat   []GooglechatIntegration   `json:"googlechat,omitempty"`
	Jira         []JiraIntegration         `json:"jira,omitempty"`
	Kafka        []KafkaIntegration        `json:"kafka,omitempty"`
	Line         []LineIntegration         `json:"line,omitempty"`
	Mqtt         []MqttIntegration         `json:"mqtt,omitempty"`
	Opsgenie     []OpsgenieIntegration     `json:"opsgenie,omitempty"`
	Pagerduty    []PagerdutyIntegration    `json:"pagerduty,omitempty"`
	Oncall       []OnCallIntegration       `json:"oncall,omitempty"`
	Pushover     []PushoverIntegration     `json:"pushover,omitempty"`
	Sensugo      []SensugoIntegration      `json:"sensugo,omitempty"`
	Slack        []SlackIntegration        `json:"slack,omitempty"`
	Sns          []SnsIntegration          `json:"sns,omitempty"`
	Teams        []TeamsIntegration        `json:"teams,omitempty"`
	Telegram     []TelegramIntegration     `json:"telegram,omitempty"`
	Threema      []ThreemaIntegration      `json:"threema,omitempty"`
	Victorops    []VictoropsIntegration    `json:"victorops,omitempty"`
	Webhook      []WebhookIntegration      `json:"webhook,omitempty"`
	Wecom        []WecomIntegration        `json:"wecom,omitempty"`
	Webex        []WebexIntegration        `json:"webex,omitempty"`
}

// NewV0alpha2SpecIntegrations creates a new V0alpha2SpecIntegrations object.
func NewV0alpha2SpecIntegrations() *V0alpha2SpecIntegrations {
	return &V0alpha2SpecIntegrations{}
}
