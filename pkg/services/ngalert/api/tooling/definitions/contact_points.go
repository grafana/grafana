package definitions

// This file contains API models of integrations that are supported by Grafana Managed Alerts.
// The models below match the Config models described in the module github.com/grafana/alerting, package 'receivers/**'
// as well as models described in Grafana Terraform Provider.
// Currently, they are used only for export to HCL but in the future we expand their scope.
// The consistency between  models in the alerting module and this file is enforced by unit-tests.

//
// 1. JSON tags are used for unmarshalling from the definitions.PostableGrafanaReceiver.Settings.
// 2. YAML tags are not used but kept while copying of models from the alerting module
// 3. Each integration struct contains field 'DisableResolveMessage'. In Terraform provider the field is on the same level as the settings.
//    Currently, HCL encoder does not support composition of structures or generic ones. This can be change after https://github.com/hashicorp/hcl/issues/290 is solved.
// 4. Sensitive fields have type Secret. Currently, this is done for information purpose and is not used anywhere.

// A string that contain sensitive information.
type Secret string // TODO implement masking fields when models are used

type AlertmanagerIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"` // TODO change when https://github.com/hashicorp/hcl/issues/290 is fixed

	URL      string  `json:"url" yaml:"url" hcl:"url"`
	User     *string `json:"basicAuthUser,omitempty" yaml:"basicAuthUser,omitempty" hcl:"basic_auth_user"`
	Password *Secret `json:"basicAuthPassword,omitempty" yaml:"basicAuthPassword,omitempty" hcl:"basic_auth_password"`
}

type DingdingIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL         string  `json:"url,omitempty" yaml:"url,omitempty" hcl:"url"`
	MessageType *string `json:"msgType,omitempty" yaml:"msgType,omitempty" hcl:"message_type"`
	Title       *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message     *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type DiscordIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	WebhookURL         Secret  `json:"url" yaml:"url" hcl:"url"`
	Title              *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message            *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	AvatarURL          *string `json:"avatar_url,omitempty" yaml:"avatar_url,omitempty" hcl:"avatar_url"`
	UseDiscordUsername *bool   `json:"use_discord_username,omitempty" yaml:"use_discord_username,omitempty" hcl:"use_discord_username"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type EmailIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	Addresses []string `json:"addresses" yaml:"addresses" hcl:"addresses"`

	SingleEmail *bool   `json:"singleEmail,omitempty" yaml:"singleEmail,omitempty" hcl:"single_email"`
	Message     *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	Subject     *string `json:"subject,omitempty" yaml:"subject,omitempty" hcl:"subject"`
}

type GooglechatIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL Secret `json:"url" yaml:"url" hcl:"url"`

	Title   *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type JiraIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL       string `yaml:"api_url,omitempty" json:"api_url,omitempty" hcl:"api_url"`
	Project   string `yaml:"project,omitempty" json:"project,omitempty" hcl:"project"`
	IssueType string `yaml:"issue_type,omitempty" json:"issue_type,omitempty" hcl:"issue_type"`

	Summary           *string   `yaml:"summary,omitempty" json:"summary,omitempty" hcl:"summary"`
	Description       *string   `yaml:"description,omitempty" json:"description,omitempty" hcl:"description"`
	Labels            *[]string `yaml:"labels,omitempty" json:"labels,omitempty" hcl:"labels"`
	Priority          *string   `yaml:"priority,omitempty" json:"priority,omitempty" hcl:"priority"`
	ReopenTransition  *string   `yaml:"reopen_transition,omitempty" json:"reopen_transition,omitempty" hcl:"reopen_transition"`
	ResolveTransition *string   `yaml:"resolve_transition,omitempty" json:"resolve_transition,omitempty" hcl:"resolve_transition"`
	WontFixResolution *string   `yaml:"wont_fix_resolution,omitempty" json:"wont_fix_resolution,omitempty" hcl:"wont_fix_resolution"`
	ReopenDuration    *string   `yaml:"reopen_duration,omitempty" json:"reopen_duration,omitempty" hcl:"reopen_duration"`
	DedupKeyFieldName *string   `yaml:"dedup_key_field,omitempty" json:"dedup_key_field,omitempty" hcl:"dedup_key_field"`

	// This should be a map[string]any but gohcl does not support encoding that type. Instead, we force it to a string
	// using a jsoniter extension `mapToJSONStringCodec` which will be handled in the TF provider.
	Fields *string `yaml:"fields,omitempty" json:"fields,omitempty" hcl:"fields"`

	User     *Secret `yaml:"user,omitempty" json:"user,omitempty" hcl:"user"`
	Password *Secret `yaml:"password,omitempty" json:"password,omitempty" hcl:"password"`
	Token    *Secret `yaml:"api_token,omitempty" json:"api_token,omitempty" hcl:"api_token"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type KafkaIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	Endpoint Secret `json:"kafkaRestProxy" yaml:"kafkaRestProxy" hcl:"rest_proxy_url"`
	Topic    string `json:"kafkaTopic" yaml:"kafkaTopic" hcl:"topic"`

	Description    *string `json:"description,omitempty" yaml:"description,omitempty" hcl:"description"`
	Details        *string `json:"details,omitempty" yaml:"details,omitempty" hcl:"details"`
	Username       *string `json:"username,omitempty" yaml:"username,omitempty" hcl:"username"`
	Password       *Secret `json:"password,omitempty" yaml:"password,omitempty" hcl:"password"`
	APIVersion     *string `json:"apiVersion,omitempty" yaml:"apiVersion,omitempty" hcl:"api_version"`
	KafkaClusterID *string `json:"kafkaClusterId,omitempty" yaml:"kafkaClusterId,omitempty" hcl:"cluster_id"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type LineIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	Token Secret `json:"token" yaml:"token" hcl:"token"`

	Title       *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Description *string `json:"description,omitempty" yaml:"description,omitempty" hcl:"description"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type TLSConfig struct {
	InsecureSkipVerify   *bool   `json:"insecureSkipVerify,omitempty" yaml:"insecureSkipVerify,omitempty" hcl:"insecure_skip_verify"`
	TLSCACertificate     *Secret `json:"caCertificate,omitempty" yaml:"caCertificate,omitempty" hcl:"ca_certificate"`
	TLSClientCertificate *Secret `json:"clientCertificate,omitempty" yaml:"clientCertificate,omitempty" hcl:"client_certificate"`
	TLSClientKey         *Secret `json:"clientKey,omitempty" yaml:"clientKey,omitempty" hcl:"client_key"`
}

type MqttIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	BrokerURL     *string    `json:"brokerUrl,omitempty" yaml:"brokerUrl,omitempty" hcl:"broker_url"`
	ClientID      *string    `json:"clientId,omitempty" yaml:"clientId,omitempty" hcl:"client_id"`
	Topic         *string    `json:"topic,omitempty" yaml:"topic,omitempty" hcl:"topic"`
	Message       *string    `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	MessageFormat *string    `json:"messageFormat,omitempty" yaml:"messageFormat,omitempty" hcl:"message_format"`
	Username      *string    `json:"username,omitempty" yaml:"username,omitempty" hcl:"username"`
	Password      *Secret    `json:"password,omitempty" yaml:"password,omitempty" hcl:"password"`
	QoS           *int64     `json:"qos,omitempty" yaml:"qos,omitempty" hcl:"qos"`
	Retain        *bool      `json:"retain,omitempty" yaml:"retain,omitempty" hcl:"retain"`
	TLSConfig     *TLSConfig `json:"tlsConfig,omitempty" yaml:"tlsConfig,omitempty" hcl:"tls_config,block"`
}

type OnCallIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL string `json:"url" yaml:"url" hcl:"url"`

	HTTPMethod               *string `json:"httpMethod,omitempty" yaml:"httpMethod,omitempty" hcl:"http_method"`
	MaxAlerts                *int64  `json:"maxAlerts,omitempty" yaml:"maxAlerts,omitempty" hcl:"max_alerts"`
	AuthorizationScheme      *string `json:"authorization_scheme,omitempty" yaml:"authorization_scheme,omitempty" hcl:"authorization_scheme"`
	AuthorizationCredentials *Secret `json:"authorization_credentials,omitempty" yaml:"authorization_credentials,omitempty" hcl:"authorization_credentials"`
	User                     *string `json:"username,omitempty" yaml:"username,omitempty" hcl:"basic_auth_user"`
	Password                 *Secret `json:"password,omitempty" yaml:"password,omitempty" hcl:"basic_auth_password"`
	Title                    *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message                  *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type OpsgenieIntegrationResponder struct {
	ID       *string `json:"id,omitempty" yaml:"id,omitempty" hcl:"id"`
	Name     *string `json:"name,omitempty" yaml:"name,omitempty" hcl:"name"`
	Username *string `json:"username,omitempty" yaml:"username,omitempty" hcl:"username"`
	Type     string  `json:"type" yaml:"type" hcl:"type"`
}

type OpsgenieIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	APIKey Secret `json:"apiKey" yaml:"apiKey" hcl:"api_key"`

	APIUrl           *string                        `json:"apiUrl,omitempty" yaml:"apiUrl,omitempty" hcl:"url"`
	Message          *string                        `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	Description      *string                        `json:"description,omitempty" yaml:"description,omitempty" hcl:"description"`
	AutoClose        *bool                          `json:"autoClose,omitempty" yaml:"autoClose,omitempty" hcl:"auto_close"`
	OverridePriority *bool                          `json:"overridePriority,omitempty" yaml:"overridePriority,omitempty" hcl:"override_priority"`
	SendTagsAs       *string                        `json:"sendTagsAs,omitempty" yaml:"sendTagsAs,omitempty" hcl:"send_tags_as"`
	Responders       []OpsgenieIntegrationResponder `json:"responders,omitempty" yaml:"responders,omitempty" hcl:"responders,block"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type PagerdutyIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	Key Secret `json:"integrationKey" yaml:"integrationKey" hcl:"integration_key"`

	Severity  *string            `json:"severity,omitempty" yaml:"severity,omitempty" hcl:"severity"`
	Class     *string            `json:"class,omitempty" yaml:"class,omitempty" hcl:"class"`
	Component *string            `json:"component,omitempty" yaml:"component,omitempty" hcl:"component"`
	Group     *string            `json:"group,omitempty" yaml:"group,omitempty" hcl:"group"`
	Summary   *string            `json:"summary,omitempty" yaml:"summary,omitempty" hcl:"summary"`
	Source    *string            `json:"source,omitempty" yaml:"source,omitempty" hcl:"source"`
	Client    *string            `json:"client,omitempty" yaml:"client,omitempty" hcl:"client"`
	ClientURL *string            `json:"client_url,omitempty" yaml:"client_url,omitempty" hcl:"client_url"`
	Details   *map[string]string `json:"details,omitempty" yaml:"details,omitempty" hcl:"details"`
	URL       *string            `json:"url,omitempty" yaml:"url,omitempty" hcl:"url"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type PushoverIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	UserKey  Secret `json:"userKey" yaml:"userKey" hcl:"user_key"`
	APIToken Secret `json:"apiToken" yaml:"apiToken" hcl:"api_token"`

	AlertingPriority *int64  `json:"priority,omitempty" yaml:"priority,omitempty" hcl:"priority"`
	OKPriority       *int64  `json:"okPriority,omitempty" yaml:"okPriority,omitempty" hcl:"ok_priority"`
	Retry            *int64  `json:"retry,omitempty" yaml:"retry,omitempty" hcl:"retry"`
	Expire           *int64  `json:"expire,omitempty" yaml:"expire,omitempty" hcl:"expire"`
	Device           *string `json:"device,omitempty" yaml:"device,omitempty" hcl:"device"`
	AlertingSound    *string `json:"sound,omitempty" yaml:"sound,omitempty" hcl:"sound"`
	OKSound          *string `json:"okSound,omitempty" yaml:"okSound,omitempty" hcl:"ok_sound"`
	Title            *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message          *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	UploadImage      *bool   `json:"uploadImage,omitempty" yaml:"uploadImage,omitempty" hcl:"upload_image"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type SensugoIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL    string `json:"url" yaml:"url" hcl:"url"`
	APIKey Secret `json:"apikey" yaml:"apikey" hcl:"api_key"`

	Entity    *string `json:"entity,omitempty" yaml:"entity,omitempty" hcl:"entity"`
	Check     *string `json:"check,omitempty" yaml:"check,omitempty" hcl:"check"`
	Namespace *string `json:"namespace,omitempty" yaml:"namespace,omitempty" hcl:"namespace"`
	Handler   *string `json:"handler,omitempty" yaml:"handler,omitempty" hcl:"handler"`
	Message   *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type SigV4Config struct {
	Region    *string `json:"region,omitempty" yaml:"region,omitempty" hcl:"region"`
	AccessKey *Secret `json:"access_key,omitempty" yaml:"access_key,omitempty" hcl:"access_key"`
	SecretKey *Secret `json:"secret_key,omitempty" yaml:"secret_key,omitempty" hcl:"secret_key"`
	Profile   *string `json:"profile,omitempty" yaml:"profile,omitempty" hcl:"profile"`
	RoleARN   *string `json:"role_arn,omitempty" yaml:"role_arn,omitempty" hcl:"role_arn"`
}

type SnsIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	APIUrl      *string            `yaml:"api_url,omitempty" json:"api_url,omitempty" hcl:"api_url"`
	Sigv4       SigV4Config        `yaml:"sigv4" json:"sigv4" hcl:"sigv4,block"`
	TopicARN    *string            `yaml:"topic_arn,omitempty" json:"topic_arn,omitempty" hcl:"topic_arn"`
	PhoneNumber *string            `yaml:"phone_number,omitempty" json:"phone_number,omitempty" hcl:"phone_number"`
	TargetARN   *string            `yaml:"target_arn,omitempty" json:"target_arn,omitempty" hcl:"target_arn"`
	Subject     *string            `yaml:"subject,omitempty" json:"subject,omitempty" hcl:"subject"`
	Message     *string            `yaml:"message,omitempty" json:"message,omitempty" hcl:"message"`
	Attributes  *map[string]string `yaml:"attributes,omitempty" json:"attributes,omitempty" hcl:"attributes"`
}

type SlackIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	EndpointURL    *string `json:"endpointUrl,omitempty" yaml:"endpointUrl,omitempty" hcl:"endpoint_url"`
	URL            *Secret `json:"url,omitempty" yaml:"url,omitempty" hcl:"url"`
	Token          *Secret `json:"token,omitempty" yaml:"token,omitempty" hcl:"token"`
	Recipient      *string `json:"recipient,omitempty" yaml:"recipient,omitempty" hcl:"recipient"`
	Text           *string `json:"text,omitempty" yaml:"text,omitempty" hcl:"text"`
	Title          *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Username       *string `json:"username,omitempty" yaml:"username,omitempty" hcl:"username"`
	IconEmoji      *string `json:"icon_emoji,omitempty" yaml:"icon_emoji,omitempty" hcl:"icon_emoji"`
	IconURL        *string `json:"icon_url,omitempty" yaml:"icon_url,omitempty" hcl:"icon_url"`
	MentionChannel *string `json:"mentionChannel,omitempty" yaml:"mentionChannel,omitempty" hcl:"mention_channel"`
	MentionUsers   *string `json:"mentionUsers,omitempty" yaml:"mentionUsers,omitempty" hcl:"mention_users"`
	MentionGroups  *string `json:"mentionGroups,omitempty" yaml:"mentionGroups,omitempty" hcl:"mention_groups"`
	Color          *string `json:"color,omitempty" yaml:"color,omitempty" hcl:"color"`
}

type TelegramIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	BotToken        Secret `json:"bottoken" yaml:"bottoken" hcl:"token"`
	ChatID          string `json:"chatid,omitempty" yaml:"chatid,omitempty" hcl:"chat_id"`
	MessageThreadID string `json:"message_thread_id,omitempty" yaml:"message_thread_id,omitempty" hcl:"message_thread_id"`

	Message               *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	ParseMode             *string `json:"parse_mode,omitempty" yaml:"parse_mode,omitempty" hcl:"parse_mode"`
	DisableWebPagePreview *bool   `json:"disable_web_page_preview,omitempty" yaml:"disable_web_page_preview,omitempty" hcl:"disable_web_page_preview"`
	ProtectContent        *bool   `json:"protect_content,omitempty" yaml:"protect_content,omitempty" hcl:"protect_content"`
	DisableNotifications  *bool   `json:"disable_notifications,omitempty" yaml:"disable_notifications,omitempty" hcl:"disable_notifications"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type TeamsIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL Secret `json:"url,omitempty" yaml:"url,omitempty" hcl:"url"`

	Message      *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	Title        *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	SectionTitle *string `json:"sectiontitle,omitempty" yaml:"sectiontitle,omitempty" hcl:"section_title"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type ThreemaIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	GatewayID   string `json:"gateway_id" yaml:"gateway_id" hcl:"gateway_id"`
	RecipientID string `json:"recipient_id" yaml:"recipient_id" hcl:"recipient_id"`
	APISecret   Secret `json:"api_secret" yaml:"api_secret" hcl:"api_secret"`

	Title       *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Description *string `json:"description,omitempty" yaml:"description,omitempty" hcl:"description"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type VictoropsIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL Secret `json:"url" yaml:"url" hcl:"url"`

	MessageType *string `json:"messageType,omitempty" yaml:"messageType,omitempty" hcl:"message_type"`
	Title       *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Description *string `json:"description,omitempty" yaml:"description,omitempty" hcl:"description"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type WebexIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	Token Secret `json:"bot_token" yaml:"bot_token" hcl:"token"`

	APIURL  *string `json:"api_url,omitempty" yaml:"api_url,omitempty" hcl:"api_url"`
	Message *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	RoomID  *string `json:"room_id,omitempty" yaml:"room_id,omitempty" hcl:"room_id"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type WebhookIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL string `json:"url" yaml:"url" hcl:"url"`

	HTTPMethod               *string            `json:"httpMethod,omitempty" yaml:"httpMethod,omitempty" hcl:"http_method"`
	MaxAlerts                *int64             `json:"maxAlerts,omitempty" yaml:"maxAlerts,omitempty" hcl:"max_alerts"`
	AuthorizationScheme      *string            `json:"authorization_scheme,omitempty" yaml:"authorization_scheme,omitempty" hcl:"authorization_scheme"`
	AuthorizationCredentials *Secret            `json:"authorization_credentials,omitempty" yaml:"authorization_credentials,omitempty" hcl:"authorization_credentials"`
	User                     *string            `json:"username,omitempty" yaml:"username,omitempty" hcl:"basic_auth_user"`
	Password                 *Secret            `json:"password,omitempty" yaml:"password,omitempty" hcl:"basic_auth_password"`
	ExtraHeaders             *map[string]string `json:"headers,omitempty" yaml:"headers,omitempty" hcl:"headers"`
	Title                    *string            `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	Message                  *string            `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	TLSConfig                *TLSConfig         `json:"tlsConfig,omitempty" yaml:"tlsConfig,omitempty" hcl:"tlsConfig,block"`
	HMACConfig               *HMACConfig        `json:"hmacConfig,omitempty" yaml:"hmacConfig,omitempty" hcl:"hmacConfig,block"`
	Payload                  *CustomPayload     `json:"payload,omitempty" yaml:"payload,omitempty" hcl:"payload,block"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type CustomPayload struct {
	Template *string            `json:"template,omitempty" yaml:"template,omitempty" hcl:"template"`
	Vars     *map[string]string `json:"vars,omitempty" yaml:"vars,omitempty" hcl:"vars"`
}

type HMACConfig struct {
	// Secret to use for HMAC signing.
	Secret *Secret `json:"secret,omitempty" yaml:"secret,omitempty" hcl:"secret"`
	// Header is the name of the header containing the HMAC signature.
	Header string `json:"header,omitempty" yaml:"header,omitempty" hcl:"header"`
	// TimestampHeader is the name of the header containing the timestamp
	// used to generate the HMAC signature. If empty, timestamp is not included.
	TimestampHeader string `yaml:"timestampHeader,omitempty" json:"timestampHeader,omitempty" hcl:"timestamp_header"`
}

// HTTPClientConfig holds common configurations for notifier HTTP clients.
type HTTPClientConfig struct {
	OAuth2Config *OAuth2Config `json:"oauth2,omitempty" yaml:"oauth2,omitempty" hcl:"oauth2,block"`
}

type ProxyConfig struct {
	// ProxyURL is the HTTP proxy server to use to connect to the targets.
	ProxyURL *string `yaml:"proxy_url,omitempty" json:"proxy_url,omitempty" hcl:"proxy_url"`
	// NoProxy contains addresses that should not use a proxy.
	NoProxy *string `yaml:"no_proxy,omitempty" json:"no_proxy,omitempty" hcl:"no_proxy"`
	// ProxyFromEnvironment uses environment HTTP_PROXY, HTTPS_PROXY and NO_PROXY to determine proxies.
	ProxyFromEnvironment *bool `yaml:"proxy_from_environment,omitempty" json:"proxy_from_environment,omitempty" hcl:"proxy_from_environment"`
	// ProxyConnectHeader optionally specifies headers to send to proxies during CONNECT requests.
	ProxyConnectHeader *map[string]string `yaml:"proxy_connect_header,omitempty" json:"proxy_connect_header,omitempty" hcl:"proxy_connect_header"`
}

type OAuth2Config struct {
	// ClientID is the OAuth2 client ID.
	ClientID string `json:"client_id" yaml:"client_id" hcl:"client_id"`
	// ClientSecret is the OAuth2 client secret.
	ClientSecret *Secret `json:"client_secret" yaml:"client_secret" hcl:"client_secret"`
	// TokenURL is the URL to get the OAuth2 token.
	TokenURL string `json:"token_url" yaml:"token_url" hcl:"token_url"`

	// Scopes is the optional list of OAuth2 scopes.
	Scopes *[]string `json:"scopes,omitempty" yaml:"scopes,omitempty" hcl:"scopes"`
	// EndpointParams is the optional map of additional parameters to include in the token request.
	EndpointParams *map[string]string `json:"endpoint_params,omitempty" yaml:"endpoint_params,omitempty" hcl:"endpoint_params"`
	// TLSConfig is the optional TLS configuration to use for the OAuth2 token request.
	TLSConfig *TLSConfig `json:"tls_config,omitempty" yaml:"tls_config,omitempty" hcl:"tls_config,block"`

	// ProxyConfig is the optional proxy configuration to use for the OAuth2 token request.
	ProxyConfig *ProxyConfig `json:"proxy_config,omitempty" yaml:"proxy_config,omitempty" hcl:"proxy_config,block"`
}

type WecomIntegration struct {
	DisableResolveMessage *bool `json:"-" yaml:"-" hcl:"disable_resolve_message"`

	URL     *Secret `json:"url,omitempty" yaml:"url,omitempty" hcl:"url"`
	Secret  *Secret `json:"secret,omitempty" yaml:"secret,omitempty" hcl:"secret"`
	AgentID *string `json:"agent_id,omitempty" yaml:"agent_id,omitempty" hcl:"agent_id"`
	CorpID  *string `json:"corp_id,omitempty" yaml:"corp_id,omitempty" hcl:"corp_id"`
	Message *string `json:"message,omitempty" yaml:"message,omitempty" hcl:"message"`
	Title   *string `json:"title,omitempty" yaml:"title,omitempty" hcl:"title"`
	MsgType *string `json:"msgtype,omitempty" yaml:"msgtype,omitempty" hcl:"msg_type"`
	ToUser  *string `json:"touser,omitempty" yaml:"touser,omitempty" hcl:"to_user"`

	HTTPConfig *HTTPClientConfig `json:"http_config,omitempty" yaml:"http_config,omitempty" hcl:"http_config,block"`
}

type ContactPoint struct {
	Name         string                    `json:"name" yaml:"name" hcl:"name"`
	Alertmanager []AlertmanagerIntegration `json:"alertmanager" yaml:"alertmanager" hcl:"alertmanager,block"`
	Dingding     []DingdingIntegration     `json:"dingding" yaml:"dingding" hcl:"dingding,block"`
	Discord      []DiscordIntegration      `json:"discord" yaml:"discord" hcl:"discord,block"`
	Email        []EmailIntegration        `json:"email" yaml:"email" hcl:"email,block"`
	Googlechat   []GooglechatIntegration   `json:"googlechat" yaml:"googlechat" hcl:"googlechat,block"`
	Jira         []JiraIntegration         `json:"jira" yaml:"jira" hcl:"jira,block"`
	Kafka        []KafkaIntegration        `json:"kafka" yaml:"kafka" hcl:"kafka,block"`
	Line         []LineIntegration         `json:"line" yaml:"line" hcl:"line,block"`
	Mqtt         []MqttIntegration         `json:"mqtt" yaml:"mqtt" hcl:"mqtt,block"`
	Opsgenie     []OpsgenieIntegration     `json:"opsgenie" yaml:"opsgenie" hcl:"opsgenie,block"`
	Pagerduty    []PagerdutyIntegration    `json:"pagerduty" yaml:"pagerduty" hcl:"pagerduty,block"`
	OnCall       []OnCallIntegration       `json:"oncall" yaml:"oncall" hcl:"oncall,block"`
	Pushover     []PushoverIntegration     `json:"pushover" yaml:"pushover" hcl:"pushover,block"`
	Sensugo      []SensugoIntegration      `json:"sensugo" yaml:"sensugo" hcl:"sensugo,block"`
	Slack        []SlackIntegration        `json:"slack" yaml:"slack" hcl:"slack,block"`
	Sns          []SnsIntegration          `json:"sns" yaml:"sns" hcl:"sns,block"`
	Teams        []TeamsIntegration        `json:"teams" yaml:"teams" hcl:"teams,block"`
	Telegram     []TelegramIntegration     `json:"telegram" yaml:"telegram" hcl:"telegram,block"`
	Threema      []ThreemaIntegration      `json:"threema" yaml:"threema" hcl:"threema,block"`
	Victorops    []VictoropsIntegration    `json:"victorops" yaml:"victorops" hcl:"victorops,block"`
	Webhook      []WebhookIntegration      `json:"webhook" yaml:"webhook" hcl:"webhook,block"`
	Wecom        []WecomIntegration        `json:"wecom" yaml:"wecom" hcl:"wecom,block"`
	Webex        []WebexIntegration        `json:"webex" yaml:"webex" hcl:"webex,block"`
}
