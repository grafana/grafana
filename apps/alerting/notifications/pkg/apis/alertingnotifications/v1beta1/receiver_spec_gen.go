// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

import (
	json "encoding/json"
)

// One definition per integration type and version, in integration_*.cue.
// +k8s:openapi-gen=true
type ReceiverIntegration = ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1

// NewReceiverIntegration creates a new ReceiverIntegration object.
func NewReceiverIntegration() *ReceiverIntegration {
	return NewReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1()
}

// +k8s:openapi-gen=true
type ReceiverDingdingV1 struct {
	Uid                   *string                                `json:"uid,omitempty"`
	DisableResolveMessage *bool                                  `json:"disableResolveMessage,omitempty"`
	Type                  string                                 `json:"type"`
	Version               string                                 `json:"version"`
	Settings              ReceiverV1beta1DingdingV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1DingdingV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                `json:"variant,omitempty"`
}

// NewReceiverDingdingV1 creates a new ReceiverDingdingV1 object.
func NewReceiverDingdingV1() *ReceiverDingdingV1 {
	return &ReceiverDingdingV1{
		Type:     "dingding",
		Version:  "v1",
		Settings: *NewReceiverV1beta1DingdingV1Settings(),
		Variant:  (func(input string) *string { return &input })("dingding/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverDingdingV1.
func (ReceiverDingdingV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverDingdingV1"
}

// +k8s:openapi-gen=true
type ReceiverDiscordV0mimir1 struct {
	Uid                   *string                                     `json:"uid,omitempty"`
	DisableResolveMessage *bool                                       `json:"disableResolveMessage,omitempty"`
	Type                  string                                      `json:"type"`
	Version               string                                      `json:"version"`
	Settings              ReceiverV1beta1DiscordV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1DiscordV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                     `json:"variant,omitempty"`
}

// NewReceiverDiscordV0mimir1 creates a new ReceiverDiscordV0mimir1 object.
func NewReceiverDiscordV0mimir1() *ReceiverDiscordV0mimir1 {
	return &ReceiverDiscordV0mimir1{
		Type:     "discord",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1DiscordV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("discord/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverDiscordV0mimir1.
func (ReceiverDiscordV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverDiscordV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverHTTPClientConfig struct {
	BasicAuth            *ReceiverBasicAuth     `json:"basic_auth,omitempty"`
	Authorization        *ReceiverAuthorization `json:"authorization,omitempty"`
	FollowRedirects      *bool                  `json:"follow_redirects,omitempty"`
	EnableHttp2          *bool                  `json:"enable_http2,omitempty"`
	HttpHeaders          map[string]string      `json:"http_headers,omitempty"`
	ProxyUrl             *string                `json:"proxy_url,omitempty"`
	NoProxy              *string                `json:"no_proxy,omitempty"`
	ProxyFromEnvironment *bool                  `json:"proxy_from_environment,omitempty"`
	ProxyConnectHeader   map[string]string      `json:"proxy_connect_header,omitempty"`
	TlsConfig            *ReceiverTLSConfig     `json:"tls_config,omitempty"`
	Oauth2               *ReceiverOAuth2        `json:"oauth2,omitempty"`
}

// NewReceiverHTTPClientConfig creates a new ReceiverHTTPClientConfig object.
func NewReceiverHTTPClientConfig() *ReceiverHTTPClientConfig {
	return &ReceiverHTTPClientConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverHTTPClientConfig.
func (ReceiverHTTPClientConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverHTTPClientConfig"
}

// +k8s:openapi-gen=true
type ReceiverBasicAuth struct {
	Username *string `json:"username,omitempty"`
}

// NewReceiverBasicAuth creates a new ReceiverBasicAuth object.
func NewReceiverBasicAuth() *ReceiverBasicAuth {
	return &ReceiverBasicAuth{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverBasicAuth.
func (ReceiverBasicAuth) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverBasicAuth"
}

// +k8s:openapi-gen=true
type ReceiverAuthorization struct {
	Type *string `json:"type,omitempty"`
}

// NewReceiverAuthorization creates a new ReceiverAuthorization object.
func NewReceiverAuthorization() *ReceiverAuthorization {
	return &ReceiverAuthorization{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverAuthorization.
func (ReceiverAuthorization) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverAuthorization"
}

// +k8s:openapi-gen=true
type ReceiverTLSConfig struct {
	ServerName         *string `json:"server_name,omitempty"`
	InsecureSkipVerify *bool   `json:"insecure_skip_verify,omitempty"`
	MinVersion         *string `json:"min_version,omitempty"`
	MaxVersion         *string `json:"max_version,omitempty"`
}

// NewReceiverTLSConfig creates a new ReceiverTLSConfig object.
func NewReceiverTLSConfig() *ReceiverTLSConfig {
	return &ReceiverTLSConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTLSConfig.
func (ReceiverTLSConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTLSConfig"
}

// +k8s:openapi-gen=true
type ReceiverOAuth2 struct {
	ClientId             string             `json:"client_id"`
	TokenUrl             string             `json:"token_url"`
	Scopes               *string            `json:"scopes,omitempty"`
	EndpointParams       map[string]string  `json:"endpoint_params,omitempty"`
	TlsConfig            *ReceiverTLSConfig `json:"tls_config,omitempty"`
	ProxyUrl             *string            `json:"proxy_url,omitempty"`
	NoProxy              *string            `json:"no_proxy,omitempty"`
	ProxyFromEnvironment *bool              `json:"proxy_from_environment,omitempty"`
	ProxyConnectHeader   map[string]string  `json:"proxy_connect_header,omitempty"`
}

// NewReceiverOAuth2 creates a new ReceiverOAuth2 object.
func NewReceiverOAuth2() *ReceiverOAuth2 {
	return &ReceiverOAuth2{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverOAuth2.
func (ReceiverOAuth2) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverOAuth2"
}

// +k8s:openapi-gen=true
type ReceiverDiscordV1 struct {
	Uid                   *string                               `json:"uid,omitempty"`
	DisableResolveMessage *bool                                 `json:"disableResolveMessage,omitempty"`
	Type                  string                                `json:"type"`
	Version               string                                `json:"version"`
	Settings              ReceiverV1beta1DiscordV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1DiscordV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                               `json:"variant,omitempty"`
}

// NewReceiverDiscordV1 creates a new ReceiverDiscordV1 object.
func NewReceiverDiscordV1() *ReceiverDiscordV1 {
	return &ReceiverDiscordV1{
		Type:     "discord",
		Version:  "v1",
		Settings: *NewReceiverV1beta1DiscordV1Settings(),
		Variant:  (func(input string) *string { return &input })("discord/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverDiscordV1.
func (ReceiverDiscordV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverDiscordV1"
}

// +k8s:openapi-gen=true
type ReceiverEmailV0mimir1 struct {
	Uid                   *string                                   `json:"uid,omitempty"`
	DisableResolveMessage *bool                                     `json:"disableResolveMessage,omitempty"`
	Type                  string                                    `json:"type"`
	Version               string                                    `json:"version"`
	Settings              ReceiverV1beta1EmailV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1EmailV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                   `json:"variant,omitempty"`
}

// NewReceiverEmailV0mimir1 creates a new ReceiverEmailV0mimir1 object.
func NewReceiverEmailV0mimir1() *ReceiverEmailV0mimir1 {
	return &ReceiverEmailV0mimir1{
		Type:     "email",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1EmailV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("email/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverEmailV0mimir1.
func (ReceiverEmailV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverEmailV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverEmailV1 struct {
	Uid                   *string                        `json:"uid,omitempty"`
	DisableResolveMessage *bool                          `json:"disableResolveMessage,omitempty"`
	Type                  string                         `json:"type"`
	Version               string                         `json:"version"`
	Settings              ReceiverV1beta1EmailV1Settings `json:"settings"`
	Variant               *string                        `json:"variant,omitempty"`
}

// NewReceiverEmailV1 creates a new ReceiverEmailV1 object.
func NewReceiverEmailV1() *ReceiverEmailV1 {
	return &ReceiverEmailV1{
		Type:     "email",
		Version:  "v1",
		Settings: *NewReceiverV1beta1EmailV1Settings(),
		Variant:  (func(input string) *string { return &input })("email/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverEmailV1.
func (ReceiverEmailV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverEmailV1"
}

// +k8s:openapi-gen=true
type ReceiverGooglechatV1 struct {
	Uid                   *string                                  `json:"uid,omitempty"`
	DisableResolveMessage *bool                                    `json:"disableResolveMessage,omitempty"`
	Type                  string                                   `json:"type"`
	Version               string                                   `json:"version"`
	Settings              ReceiverV1beta1GooglechatV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1GooglechatV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                  `json:"variant,omitempty"`
}

// NewReceiverGooglechatV1 creates a new ReceiverGooglechatV1 object.
func NewReceiverGooglechatV1() *ReceiverGooglechatV1 {
	return &ReceiverGooglechatV1{
		Type:     "googlechat",
		Version:  "v1",
		Settings: *NewReceiverV1beta1GooglechatV1Settings(),
		Variant:  (func(input string) *string { return &input })("googlechat/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverGooglechatV1.
func (ReceiverGooglechatV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverGooglechatV1"
}

// +k8s:openapi-gen=true
type ReceiverJiraV0mimir1 struct {
	Uid                   *string                                  `json:"uid,omitempty"`
	DisableResolveMessage *bool                                    `json:"disableResolveMessage,omitempty"`
	Type                  string                                   `json:"type"`
	Version               string                                   `json:"version"`
	Settings              ReceiverV1beta1JiraV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1JiraV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                  `json:"variant,omitempty"`
}

// NewReceiverJiraV0mimir1 creates a new ReceiverJiraV0mimir1 object.
func NewReceiverJiraV0mimir1() *ReceiverJiraV0mimir1 {
	return &ReceiverJiraV0mimir1{
		Type:     "jira",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1JiraV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("jira/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverJiraV0mimir1.
func (ReceiverJiraV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverJiraV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverJiraV1 struct {
	Uid                   *string                            `json:"uid,omitempty"`
	DisableResolveMessage *bool                              `json:"disableResolveMessage,omitempty"`
	Type                  string                             `json:"type"`
	Version               string                             `json:"version"`
	Settings              ReceiverV1beta1JiraV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1JiraV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                            `json:"variant,omitempty"`
}

// NewReceiverJiraV1 creates a new ReceiverJiraV1 object.
func NewReceiverJiraV1() *ReceiverJiraV1 {
	return &ReceiverJiraV1{
		Type:     "jira",
		Version:  "v1",
		Settings: *NewReceiverV1beta1JiraV1Settings(),
		Variant:  (func(input string) *string { return &input })("jira/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverJiraV1.
func (ReceiverJiraV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverJiraV1"
}

// +k8s:openapi-gen=true
type ReceiverKafkaV1 struct {
	Uid                   *string                             `json:"uid,omitempty"`
	DisableResolveMessage *bool                               `json:"disableResolveMessage,omitempty"`
	Type                  string                              `json:"type"`
	Version               string                              `json:"version"`
	Settings              ReceiverV1beta1KafkaV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1KafkaV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                             `json:"variant,omitempty"`
}

// NewReceiverKafkaV1 creates a new ReceiverKafkaV1 object.
func NewReceiverKafkaV1() *ReceiverKafkaV1 {
	return &ReceiverKafkaV1{
		Type:     "kafka",
		Version:  "v1",
		Settings: *NewReceiverV1beta1KafkaV1Settings(),
		Variant:  (func(input string) *string { return &input })("kafka/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverKafkaV1.
func (ReceiverKafkaV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverKafkaV1"
}

// +k8s:openapi-gen=true
type ReceiverLINEV1 struct {
	Uid                   *string                            `json:"uid,omitempty"`
	DisableResolveMessage *bool                              `json:"disableResolveMessage,omitempty"`
	Type                  string                             `json:"type"`
	Version               string                             `json:"version"`
	Settings              ReceiverV1beta1LINEV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1LINEV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                            `json:"variant,omitempty"`
}

// NewReceiverLINEV1 creates a new ReceiverLINEV1 object.
func NewReceiverLINEV1() *ReceiverLINEV1 {
	return &ReceiverLINEV1{
		Type:     "LINE",
		Version:  "v1",
		Settings: *NewReceiverV1beta1LINEV1Settings(),
		Variant:  (func(input string) *string { return &input })("LINE/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverLINEV1.
func (ReceiverLINEV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverLINEV1"
}

// +k8s:openapi-gen=true
type ReceiverMqttV1 struct {
	Uid                   *string                            `json:"uid,omitempty"`
	DisableResolveMessage *bool                              `json:"disableResolveMessage,omitempty"`
	Type                  string                             `json:"type"`
	Version               string                             `json:"version"`
	Settings              ReceiverV1beta1MqttV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1MqttV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                            `json:"variant,omitempty"`
}

// NewReceiverMqttV1 creates a new ReceiverMqttV1 object.
func NewReceiverMqttV1() *ReceiverMqttV1 {
	return &ReceiverMqttV1{
		Type:     "mqtt",
		Version:  "v1",
		Settings: *NewReceiverV1beta1MqttV1Settings(),
		Variant:  (func(input string) *string { return &input })("mqtt/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverMqttV1.
func (ReceiverMqttV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverMqttV1"
}

// +k8s:openapi-gen=true
type ReceiverGrafanaTLSConfig struct {
	InsecureSkipVerify *bool `json:"insecureSkipVerify,omitempty"`
}

// NewReceiverGrafanaTLSConfig creates a new ReceiverGrafanaTLSConfig object.
func NewReceiverGrafanaTLSConfig() *ReceiverGrafanaTLSConfig {
	return &ReceiverGrafanaTLSConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverGrafanaTLSConfig.
func (ReceiverGrafanaTLSConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverGrafanaTLSConfig"
}

// +k8s:openapi-gen=true
type ReceiverOncallV1 struct {
	Uid                   *string                              `json:"uid,omitempty"`
	DisableResolveMessage *bool                                `json:"disableResolveMessage,omitempty"`
	Type                  string                               `json:"type"`
	Version               string                               `json:"version"`
	Settings              ReceiverV1beta1OncallV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1OncallV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                              `json:"variant,omitempty"`
}

// NewReceiverOncallV1 creates a new ReceiverOncallV1 object.
func NewReceiverOncallV1() *ReceiverOncallV1 {
	return &ReceiverOncallV1{
		Type:     "oncall",
		Version:  "v1",
		Settings: *NewReceiverV1beta1OncallV1Settings(),
		Variant:  (func(input string) *string { return &input })("oncall/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverOncallV1.
func (ReceiverOncallV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverOncallV1"
}

// +k8s:openapi-gen=true
type ReceiverOpsgenieV0mimir1 struct {
	Uid                   *string                                      `json:"uid,omitempty"`
	DisableResolveMessage *bool                                        `json:"disableResolveMessage,omitempty"`
	Type                  string                                       `json:"type"`
	Version               string                                       `json:"version"`
	Settings              ReceiverV1beta1OpsgenieV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1OpsgenieV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                      `json:"variant,omitempty"`
}

// NewReceiverOpsgenieV0mimir1 creates a new ReceiverOpsgenieV0mimir1 object.
func NewReceiverOpsgenieV0mimir1() *ReceiverOpsgenieV0mimir1 {
	return &ReceiverOpsgenieV0mimir1{
		Type:     "opsgenie",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1OpsgenieV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("opsgenie/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverOpsgenieV0mimir1.
func (ReceiverOpsgenieV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverOpsgenieV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverOpsgenieV1 struct {
	Uid                   *string                                `json:"uid,omitempty"`
	DisableResolveMessage *bool                                  `json:"disableResolveMessage,omitempty"`
	Type                  string                                 `json:"type"`
	Version               string                                 `json:"version"`
	Settings              ReceiverV1beta1OpsgenieV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1OpsgenieV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                `json:"variant,omitempty"`
}

// NewReceiverOpsgenieV1 creates a new ReceiverOpsgenieV1 object.
func NewReceiverOpsgenieV1() *ReceiverOpsgenieV1 {
	return &ReceiverOpsgenieV1{
		Type:     "opsgenie",
		Version:  "v1",
		Settings: *NewReceiverV1beta1OpsgenieV1Settings(),
		Variant:  (func(input string) *string { return &input })("opsgenie/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverOpsgenieV1.
func (ReceiverOpsgenieV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverOpsgenieV1"
}

// +k8s:openapi-gen=true
type ReceiverPagerdutyV0mimir1 struct {
	Uid                   *string                                       `json:"uid,omitempty"`
	DisableResolveMessage *bool                                         `json:"disableResolveMessage,omitempty"`
	Type                  string                                        `json:"type"`
	Version               string                                        `json:"version"`
	Settings              ReceiverV1beta1PagerdutyV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1PagerdutyV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                       `json:"variant,omitempty"`
}

// NewReceiverPagerdutyV0mimir1 creates a new ReceiverPagerdutyV0mimir1 object.
func NewReceiverPagerdutyV0mimir1() *ReceiverPagerdutyV0mimir1 {
	return &ReceiverPagerdutyV0mimir1{
		Type:     "pagerduty",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1PagerdutyV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("pagerduty/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverPagerdutyV0mimir1.
func (ReceiverPagerdutyV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverPagerdutyV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverPagerdutyV1 struct {
	Uid                   *string                                 `json:"uid,omitempty"`
	DisableResolveMessage *bool                                   `json:"disableResolveMessage,omitempty"`
	Type                  string                                  `json:"type"`
	Version               string                                  `json:"version"`
	Settings              ReceiverV1beta1PagerdutyV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1PagerdutyV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                 `json:"variant,omitempty"`
}

// NewReceiverPagerdutyV1 creates a new ReceiverPagerdutyV1 object.
func NewReceiverPagerdutyV1() *ReceiverPagerdutyV1 {
	return &ReceiverPagerdutyV1{
		Type:     "pagerduty",
		Version:  "v1",
		Settings: *NewReceiverV1beta1PagerdutyV1Settings(),
		Variant:  (func(input string) *string { return &input })("pagerduty/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverPagerdutyV1.
func (ReceiverPagerdutyV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverPagerdutyV1"
}

// +k8s:openapi-gen=true
type ReceiverPrometheusAlertmanagerV1 struct {
	Uid                   *string                                              `json:"uid,omitempty"`
	DisableResolveMessage *bool                                                `json:"disableResolveMessage,omitempty"`
	Type                  string                                               `json:"type"`
	Version               string                                               `json:"version"`
	Settings              ReceiverV1beta1PrometheusAlertmanagerV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1PrometheusAlertmanagerV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                              `json:"variant,omitempty"`
}

// NewReceiverPrometheusAlertmanagerV1 creates a new ReceiverPrometheusAlertmanagerV1 object.
func NewReceiverPrometheusAlertmanagerV1() *ReceiverPrometheusAlertmanagerV1 {
	return &ReceiverPrometheusAlertmanagerV1{
		Type:     "prometheus-alertmanager",
		Version:  "v1",
		Settings: *NewReceiverV1beta1PrometheusAlertmanagerV1Settings(),
		Variant:  (func(input string) *string { return &input })("prometheus-alertmanager/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverPrometheusAlertmanagerV1.
func (ReceiverPrometheusAlertmanagerV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverPrometheusAlertmanagerV1"
}

// +k8s:openapi-gen=true
type ReceiverPushoverV0mimir1 struct {
	Uid                   *string                                      `json:"uid,omitempty"`
	DisableResolveMessage *bool                                        `json:"disableResolveMessage,omitempty"`
	Type                  string                                       `json:"type"`
	Version               string                                       `json:"version"`
	Settings              ReceiverV1beta1PushoverV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1PushoverV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                      `json:"variant,omitempty"`
}

// NewReceiverPushoverV0mimir1 creates a new ReceiverPushoverV0mimir1 object.
func NewReceiverPushoverV0mimir1() *ReceiverPushoverV0mimir1 {
	return &ReceiverPushoverV0mimir1{
		Type:     "pushover",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1PushoverV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("pushover/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverPushoverV0mimir1.
func (ReceiverPushoverV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverPushoverV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverPushoverV1 struct {
	Uid                   *string                                `json:"uid,omitempty"`
	DisableResolveMessage *bool                                  `json:"disableResolveMessage,omitempty"`
	Type                  string                                 `json:"type"`
	Version               string                                 `json:"version"`
	Settings              ReceiverV1beta1PushoverV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1PushoverV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                `json:"variant,omitempty"`
}

// NewReceiverPushoverV1 creates a new ReceiverPushoverV1 object.
func NewReceiverPushoverV1() *ReceiverPushoverV1 {
	return &ReceiverPushoverV1{
		Type:     "pushover",
		Version:  "v1",
		Settings: *NewReceiverV1beta1PushoverV1Settings(),
		Variant:  (func(input string) *string { return &input })("pushover/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverPushoverV1.
func (ReceiverPushoverV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverPushoverV1"
}

// +k8s:openapi-gen=true
type ReceiverSensugoV1 struct {
	Uid                   *string                               `json:"uid,omitempty"`
	DisableResolveMessage *bool                                 `json:"disableResolveMessage,omitempty"`
	Type                  string                                `json:"type"`
	Version               string                                `json:"version"`
	Settings              ReceiverV1beta1SensugoV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1SensugoV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                               `json:"variant,omitempty"`
}

// NewReceiverSensugoV1 creates a new ReceiverSensugoV1 object.
func NewReceiverSensugoV1() *ReceiverSensugoV1 {
	return &ReceiverSensugoV1{
		Type:     "sensugo",
		Version:  "v1",
		Settings: *NewReceiverV1beta1SensugoV1Settings(),
		Variant:  (func(input string) *string { return &input })("sensugo/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSensugoV1.
func (ReceiverSensugoV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSensugoV1"
}

// +k8s:openapi-gen=true
type ReceiverSlackV0mimir1 struct {
	Uid                   *string                                   `json:"uid,omitempty"`
	DisableResolveMessage *bool                                     `json:"disableResolveMessage,omitempty"`
	Type                  string                                    `json:"type"`
	Version               string                                    `json:"version"`
	Settings              ReceiverV1beta1SlackV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1SlackV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                   `json:"variant,omitempty"`
}

// NewReceiverSlackV0mimir1 creates a new ReceiverSlackV0mimir1 object.
func NewReceiverSlackV0mimir1() *ReceiverSlackV0mimir1 {
	return &ReceiverSlackV0mimir1{
		Type:     "slack",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1SlackV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("slack/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSlackV0mimir1.
func (ReceiverSlackV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSlackV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverSlackV1 struct {
	Uid                   *string                             `json:"uid,omitempty"`
	DisableResolveMessage *bool                               `json:"disableResolveMessage,omitempty"`
	Type                  string                              `json:"type"`
	Version               string                              `json:"version"`
	Settings              ReceiverV1beta1SlackV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1SlackV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                             `json:"variant,omitempty"`
}

// NewReceiverSlackV1 creates a new ReceiverSlackV1 object.
func NewReceiverSlackV1() *ReceiverSlackV1 {
	return &ReceiverSlackV1{
		Type:     "slack",
		Version:  "v1",
		Settings: *NewReceiverV1beta1SlackV1Settings(),
		Variant:  (func(input string) *string { return &input })("slack/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSlackV1.
func (ReceiverSlackV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSlackV1"
}

// +k8s:openapi-gen=true
type ReceiverSnsV0mimir1 struct {
	Uid                   *string                                 `json:"uid,omitempty"`
	DisableResolveMessage *bool                                   `json:"disableResolveMessage,omitempty"`
	Type                  string                                  `json:"type"`
	Version               string                                  `json:"version"`
	Settings              ReceiverV1beta1SnsV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1SnsV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                 `json:"variant,omitempty"`
}

// NewReceiverSnsV0mimir1 creates a new ReceiverSnsV0mimir1 object.
func NewReceiverSnsV0mimir1() *ReceiverSnsV0mimir1 {
	return &ReceiverSnsV0mimir1{
		Type:     "sns",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1SnsV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("sns/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSnsV0mimir1.
func (ReceiverSnsV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSnsV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverSigv4 struct {
	Region  *string `json:"region,omitempty"`
	Profile *string `json:"profile,omitempty"`
	RoleArn *string `json:"role_arn,omitempty"`
}

// NewReceiverSigv4 creates a new ReceiverSigv4 object.
func NewReceiverSigv4() *ReceiverSigv4 {
	return &ReceiverSigv4{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSigv4.
func (ReceiverSigv4) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSigv4"
}

// +k8s:openapi-gen=true
type ReceiverSnsV1 struct {
	Uid                   *string                           `json:"uid,omitempty"`
	DisableResolveMessage *bool                             `json:"disableResolveMessage,omitempty"`
	Type                  string                            `json:"type"`
	Version               string                            `json:"version"`
	Settings              ReceiverV1beta1SnsV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1SnsV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                           `json:"variant,omitempty"`
}

// NewReceiverSnsV1 creates a new ReceiverSnsV1 object.
func NewReceiverSnsV1() *ReceiverSnsV1 {
	return &ReceiverSnsV1{
		Type:     "sns",
		Version:  "v1",
		Settings: *NewReceiverV1beta1SnsV1Settings(),
		Variant:  (func(input string) *string { return &input })("sns/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSnsV1.
func (ReceiverSnsV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSnsV1"
}

// +k8s:openapi-gen=true
type ReceiverTeamsV0mimir1 struct {
	Uid                   *string                                   `json:"uid,omitempty"`
	DisableResolveMessage *bool                                     `json:"disableResolveMessage,omitempty"`
	Type                  string                                    `json:"type"`
	Version               string                                    `json:"version"`
	Settings              ReceiverV1beta1TeamsV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1TeamsV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                   `json:"variant,omitempty"`
}

// NewReceiverTeamsV0mimir1 creates a new ReceiverTeamsV0mimir1 object.
func NewReceiverTeamsV0mimir1() *ReceiverTeamsV0mimir1 {
	return &ReceiverTeamsV0mimir1{
		Type:     "teams",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1TeamsV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("teams/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTeamsV0mimir1.
func (ReceiverTeamsV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTeamsV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverTeamsV0mimir2 struct {
	Uid                   *string                                   `json:"uid,omitempty"`
	DisableResolveMessage *bool                                     `json:"disableResolveMessage,omitempty"`
	Type                  string                                    `json:"type"`
	Version               string                                    `json:"version"`
	Settings              ReceiverV1beta1TeamsV0mimir2Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1TeamsV0mimir2SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                   `json:"variant,omitempty"`
}

// NewReceiverTeamsV0mimir2 creates a new ReceiverTeamsV0mimir2 object.
func NewReceiverTeamsV0mimir2() *ReceiverTeamsV0mimir2 {
	return &ReceiverTeamsV0mimir2{
		Type:     "teams",
		Version:  "v0mimir2",
		Settings: *NewReceiverV1beta1TeamsV0mimir2Settings(),
		Variant:  (func(input string) *string { return &input })("teams/v0mimir2"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTeamsV0mimir2.
func (ReceiverTeamsV0mimir2) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTeamsV0mimir2"
}

// +k8s:openapi-gen=true
type ReceiverTeamsV1 struct {
	Uid                   *string                        `json:"uid,omitempty"`
	DisableResolveMessage *bool                          `json:"disableResolveMessage,omitempty"`
	Type                  string                         `json:"type"`
	Version               string                         `json:"version"`
	Settings              ReceiverV1beta1TeamsV1Settings `json:"settings"`
	Variant               *string                        `json:"variant,omitempty"`
}

// NewReceiverTeamsV1 creates a new ReceiverTeamsV1 object.
func NewReceiverTeamsV1() *ReceiverTeamsV1 {
	return &ReceiverTeamsV1{
		Type:     "teams",
		Version:  "v1",
		Settings: *NewReceiverV1beta1TeamsV1Settings(),
		Variant:  (func(input string) *string { return &input })("teams/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTeamsV1.
func (ReceiverTeamsV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTeamsV1"
}

// +k8s:openapi-gen=true
type ReceiverTelegramV0mimir1 struct {
	Uid                   *string                                      `json:"uid,omitempty"`
	DisableResolveMessage *bool                                        `json:"disableResolveMessage,omitempty"`
	Type                  string                                       `json:"type"`
	Version               string                                       `json:"version"`
	Settings              ReceiverV1beta1TelegramV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1TelegramV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                      `json:"variant,omitempty"`
}

// NewReceiverTelegramV0mimir1 creates a new ReceiverTelegramV0mimir1 object.
func NewReceiverTelegramV0mimir1() *ReceiverTelegramV0mimir1 {
	return &ReceiverTelegramV0mimir1{
		Type:     "telegram",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1TelegramV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("telegram/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTelegramV0mimir1.
func (ReceiverTelegramV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTelegramV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverTelegramV1 struct {
	Uid                   *string                                `json:"uid,omitempty"`
	DisableResolveMessage *bool                                  `json:"disableResolveMessage,omitempty"`
	Type                  string                                 `json:"type"`
	Version               string                                 `json:"version"`
	Settings              ReceiverV1beta1TelegramV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1TelegramV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                `json:"variant,omitempty"`
}

// NewReceiverTelegramV1 creates a new ReceiverTelegramV1 object.
func NewReceiverTelegramV1() *ReceiverTelegramV1 {
	return &ReceiverTelegramV1{
		Type:     "telegram",
		Version:  "v1",
		Settings: *NewReceiverV1beta1TelegramV1Settings(),
		Variant:  (func(input string) *string { return &input })("telegram/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverTelegramV1.
func (ReceiverTelegramV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverTelegramV1"
}

// +k8s:openapi-gen=true
type ReceiverThreemaV1 struct {
	Uid                   *string                               `json:"uid,omitempty"`
	DisableResolveMessage *bool                                 `json:"disableResolveMessage,omitempty"`
	Type                  string                                `json:"type"`
	Version               string                                `json:"version"`
	Settings              ReceiverV1beta1ThreemaV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1ThreemaV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                               `json:"variant,omitempty"`
}

// NewReceiverThreemaV1 creates a new ReceiverThreemaV1 object.
func NewReceiverThreemaV1() *ReceiverThreemaV1 {
	return &ReceiverThreemaV1{
		Type:     "threema",
		Version:  "v1",
		Settings: *NewReceiverV1beta1ThreemaV1Settings(),
		Variant:  (func(input string) *string { return &input })("threema/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverThreemaV1.
func (ReceiverThreemaV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverThreemaV1"
}

// +k8s:openapi-gen=true
type ReceiverVictoropsV0mimir1 struct {
	Uid                   *string                                       `json:"uid,omitempty"`
	DisableResolveMessage *bool                                         `json:"disableResolveMessage,omitempty"`
	Type                  string                                        `json:"type"`
	Version               string                                        `json:"version"`
	Settings              ReceiverV1beta1VictoropsV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1VictoropsV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                       `json:"variant,omitempty"`
}

// NewReceiverVictoropsV0mimir1 creates a new ReceiverVictoropsV0mimir1 object.
func NewReceiverVictoropsV0mimir1() *ReceiverVictoropsV0mimir1 {
	return &ReceiverVictoropsV0mimir1{
		Type:     "victorops",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1VictoropsV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("victorops/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverVictoropsV0mimir1.
func (ReceiverVictoropsV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverVictoropsV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverVictoropsV1 struct {
	Uid                   *string                                 `json:"uid,omitempty"`
	DisableResolveMessage *bool                                   `json:"disableResolveMessage,omitempty"`
	Type                  string                                  `json:"type"`
	Version               string                                  `json:"version"`
	Settings              ReceiverV1beta1VictoropsV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1VictoropsV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                 `json:"variant,omitempty"`
}

// NewReceiverVictoropsV1 creates a new ReceiverVictoropsV1 object.
func NewReceiverVictoropsV1() *ReceiverVictoropsV1 {
	return &ReceiverVictoropsV1{
		Type:     "victorops",
		Version:  "v1",
		Settings: *NewReceiverV1beta1VictoropsV1Settings(),
		Variant:  (func(input string) *string { return &input })("victorops/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverVictoropsV1.
func (ReceiverVictoropsV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverVictoropsV1"
}

// +k8s:openapi-gen=true
type ReceiverWebexV0mimir1 struct {
	Uid                   *string                                   `json:"uid,omitempty"`
	DisableResolveMessage *bool                                     `json:"disableResolveMessage,omitempty"`
	Type                  string                                    `json:"type"`
	Version               string                                    `json:"version"`
	Settings              ReceiverV1beta1WebexV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WebexV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                   `json:"variant,omitempty"`
}

// NewReceiverWebexV0mimir1 creates a new ReceiverWebexV0mimir1 object.
func NewReceiverWebexV0mimir1() *ReceiverWebexV0mimir1 {
	return &ReceiverWebexV0mimir1{
		Type:     "webex",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1WebexV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("webex/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWebexV0mimir1.
func (ReceiverWebexV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWebexV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverWebexV1 struct {
	Uid                   *string                             `json:"uid,omitempty"`
	DisableResolveMessage *bool                               `json:"disableResolveMessage,omitempty"`
	Type                  string                              `json:"type"`
	Version               string                              `json:"version"`
	Settings              ReceiverV1beta1WebexV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WebexV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                             `json:"variant,omitempty"`
}

// NewReceiverWebexV1 creates a new ReceiverWebexV1 object.
func NewReceiverWebexV1() *ReceiverWebexV1 {
	return &ReceiverWebexV1{
		Type:     "webex",
		Version:  "v1",
		Settings: *NewReceiverV1beta1WebexV1Settings(),
		Variant:  (func(input string) *string { return &input })("webex/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWebexV1.
func (ReceiverWebexV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWebexV1"
}

// +k8s:openapi-gen=true
type ReceiverWebhookV0mimir1 struct {
	Uid                   *string                                     `json:"uid,omitempty"`
	DisableResolveMessage *bool                                       `json:"disableResolveMessage,omitempty"`
	Type                  string                                      `json:"type"`
	Version               string                                      `json:"version"`
	Settings              ReceiverV1beta1WebhookV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WebhookV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                     `json:"variant,omitempty"`
}

// NewReceiverWebhookV0mimir1 creates a new ReceiverWebhookV0mimir1 object.
func NewReceiverWebhookV0mimir1() *ReceiverWebhookV0mimir1 {
	return &ReceiverWebhookV0mimir1{
		Type:     "webhook",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1WebhookV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("webhook/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWebhookV0mimir1.
func (ReceiverWebhookV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWebhookV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverWebhookV1 struct {
	Uid                   *string                               `json:"uid,omitempty"`
	DisableResolveMessage *bool                                 `json:"disableResolveMessage,omitempty"`
	Type                  string                                `json:"type"`
	Version               string                                `json:"version"`
	Settings              ReceiverV1beta1WebhookV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WebhookV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                               `json:"variant,omitempty"`
}

// NewReceiverWebhookV1 creates a new ReceiverWebhookV1 object.
func NewReceiverWebhookV1() *ReceiverWebhookV1 {
	return &ReceiverWebhookV1{
		Type:     "webhook",
		Version:  "v1",
		Settings: *NewReceiverV1beta1WebhookV1Settings(),
		Variant:  (func(input string) *string { return &input })("webhook/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWebhookV1.
func (ReceiverWebhookV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWebhookV1"
}

// +k8s:openapi-gen=true
type ReceiverWechatV0mimir1 struct {
	Uid                   *string                                    `json:"uid,omitempty"`
	DisableResolveMessage *bool                                      `json:"disableResolveMessage,omitempty"`
	Type                  string                                     `json:"type"`
	Version               string                                     `json:"version"`
	Settings              ReceiverV1beta1WechatV0mimir1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WechatV0mimir1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                                    `json:"variant,omitempty"`
}

// NewReceiverWechatV0mimir1 creates a new ReceiverWechatV0mimir1 object.
func NewReceiverWechatV0mimir1() *ReceiverWechatV0mimir1 {
	return &ReceiverWechatV0mimir1{
		Type:     "wechat",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1WechatV0mimir1Settings(),
		Variant:  (func(input string) *string { return &input })("wechat/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWechatV0mimir1.
func (ReceiverWechatV0mimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWechatV0mimir1"
}

// +k8s:openapi-gen=true
type ReceiverWecomV1 struct {
	Uid                   *string                             `json:"uid,omitempty"`
	DisableResolveMessage *bool                               `json:"disableResolveMessage,omitempty"`
	Type                  string                              `json:"type"`
	Version               string                              `json:"version"`
	Settings              ReceiverV1beta1WecomV1Settings      `json:"settings"`
	SecureFields          *ReceiverV1beta1WecomV1SecureFields `json:"secureFields,omitempty"`
	Variant               *string                             `json:"variant,omitempty"`
}

// NewReceiverWecomV1 creates a new ReceiverWecomV1 object.
func NewReceiverWecomV1() *ReceiverWecomV1 {
	return &ReceiverWecomV1{
		Type:     "wecom",
		Version:  "v1",
		Settings: *NewReceiverV1beta1WecomV1Settings(),
		Variant:  (func(input string) *string { return &input })("wecom/v1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverWecomV1.
func (ReceiverWecomV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverWecomV1"
}

// +k8s:openapi-gen=true
type ReceiverSpec struct {
	Title        string                `json:"title"`
	Integrations []ReceiverIntegration `json:"integrations"`
}

// NewReceiverSpec creates a new ReceiverSpec object.
func NewReceiverSpec() *ReceiverSpec {
	return &ReceiverSpec{
		Integrations: []ReceiverIntegration{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSpec.
func (ReceiverSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSpec"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DingdingV1Settings struct {
	MsgType *ReceiverV1beta1DingdingV1SettingsMsgType `json:"msgType,omitempty"`
	Title   *string                                   `json:"title,omitempty"`
	Message *string                                   `json:"message,omitempty"`
}

// NewReceiverV1beta1DingdingV1Settings creates a new ReceiverV1beta1DingdingV1Settings object.
func NewReceiverV1beta1DingdingV1Settings() *ReceiverV1beta1DingdingV1Settings {
	return &ReceiverV1beta1DingdingV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DingdingV1Settings.
func (ReceiverV1beta1DingdingV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DingdingV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DingdingV1SecureFields struct {
	Url *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1DingdingV1SecureFields creates a new ReceiverV1beta1DingdingV1SecureFields object.
func NewReceiverV1beta1DingdingV1SecureFields() *ReceiverV1beta1DingdingV1SecureFields {
	return &ReceiverV1beta1DingdingV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DingdingV1SecureFields.
func (ReceiverV1beta1DingdingV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DingdingV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DiscordV0mimir1Settings struct {
	Title      *string                   `json:"title,omitempty"`
	Message    *string                   `json:"message,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1DiscordV0mimir1Settings creates a new ReceiverV1beta1DiscordV0mimir1Settings object.
func NewReceiverV1beta1DiscordV0mimir1Settings() *ReceiverV1beta1DiscordV0mimir1Settings {
	return &ReceiverV1beta1DiscordV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DiscordV0mimir1Settings.
func (ReceiverV1beta1DiscordV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DiscordV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DiscordV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	WebhookUrl                         *bool `json:"webhook_url,omitempty"`
}

// NewReceiverV1beta1DiscordV0mimir1SecureFields creates a new ReceiverV1beta1DiscordV0mimir1SecureFields object.
func NewReceiverV1beta1DiscordV0mimir1SecureFields() *ReceiverV1beta1DiscordV0mimir1SecureFields {
	return &ReceiverV1beta1DiscordV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DiscordV0mimir1SecureFields.
func (ReceiverV1beta1DiscordV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DiscordV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DiscordV1Settings struct {
	Title               *string `json:"title,omitempty"`
	Message             *string `json:"message,omitempty"`
	AvatarUrl           *string `json:"avatar_url,omitempty"`
	UseDiscordUsername  *bool   `json:"use_discord_username,omitempty"`
	UseEmbedDescription *bool   `json:"use_embed_description,omitempty"`
}

// NewReceiverV1beta1DiscordV1Settings creates a new ReceiverV1beta1DiscordV1Settings object.
func NewReceiverV1beta1DiscordV1Settings() *ReceiverV1beta1DiscordV1Settings {
	return &ReceiverV1beta1DiscordV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DiscordV1Settings.
func (ReceiverV1beta1DiscordV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DiscordV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DiscordV1SecureFields struct {
	Url *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1DiscordV1SecureFields creates a new ReceiverV1beta1DiscordV1SecureFields object.
func NewReceiverV1beta1DiscordV1SecureFields() *ReceiverV1beta1DiscordV1SecureFields {
	return &ReceiverV1beta1DiscordV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DiscordV1SecureFields.
func (ReceiverV1beta1DiscordV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DiscordV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1EmailV0mimir1Settings struct {
	To           string             `json:"to"`
	From         *string            `json:"from,omitempty"`
	Smarthost    *string            `json:"smarthost,omitempty"`
	Hello        *string            `json:"hello,omitempty"`
	AuthUsername *string            `json:"auth_username,omitempty"`
	AuthIdentity *string            `json:"auth_identity,omitempty"`
	RequireTls   *bool              `json:"require_tls,omitempty"`
	Html         *string            `json:"html,omitempty"`
	Text         *string            `json:"text,omitempty"`
	Headers      map[string]string  `json:"headers,omitempty"`
	TlsConfig    *ReceiverTLSConfig `json:"tls_config,omitempty"`
}

// NewReceiverV1beta1EmailV0mimir1Settings creates a new ReceiverV1beta1EmailV0mimir1Settings object.
func NewReceiverV1beta1EmailV0mimir1Settings() *ReceiverV1beta1EmailV0mimir1Settings {
	return &ReceiverV1beta1EmailV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1EmailV0mimir1Settings.
func (ReceiverV1beta1EmailV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1EmailV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1EmailV0mimir1SecureFields struct {
	AuthPassword *bool `json:"auth_password,omitempty"`
	AuthSecret   *bool `json:"auth_secret,omitempty"`
}

// NewReceiverV1beta1EmailV0mimir1SecureFields creates a new ReceiverV1beta1EmailV0mimir1SecureFields object.
func NewReceiverV1beta1EmailV0mimir1SecureFields() *ReceiverV1beta1EmailV0mimir1SecureFields {
	return &ReceiverV1beta1EmailV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1EmailV0mimir1SecureFields.
func (ReceiverV1beta1EmailV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1EmailV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1EmailV1Settings struct {
	SingleEmail *bool   `json:"singleEmail,omitempty"`
	Addresses   string  `json:"addresses"`
	Message     *string `json:"message,omitempty"`
	Subject     *string `json:"subject,omitempty"`
}

// NewReceiverV1beta1EmailV1Settings creates a new ReceiverV1beta1EmailV1Settings object.
func NewReceiverV1beta1EmailV1Settings() *ReceiverV1beta1EmailV1Settings {
	return &ReceiverV1beta1EmailV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1EmailV1Settings.
func (ReceiverV1beta1EmailV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1EmailV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1GooglechatV1Settings struct {
	Title           *string `json:"title,omitempty"`
	Message         *string `json:"message,omitempty"`
	HideOpenButton  *bool   `json:"hide_open_button,omitempty"`
	HideVersionInfo *bool   `json:"hide_version_info,omitempty"`
}

// NewReceiverV1beta1GooglechatV1Settings creates a new ReceiverV1beta1GooglechatV1Settings object.
func NewReceiverV1beta1GooglechatV1Settings() *ReceiverV1beta1GooglechatV1Settings {
	return &ReceiverV1beta1GooglechatV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1GooglechatV1Settings.
func (ReceiverV1beta1GooglechatV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1GooglechatV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1GooglechatV1SecureFields struct {
	Url *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1GooglechatV1SecureFields creates a new ReceiverV1beta1GooglechatV1SecureFields object.
func NewReceiverV1beta1GooglechatV1SecureFields() *ReceiverV1beta1GooglechatV1SecureFields {
	return &ReceiverV1beta1GooglechatV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1GooglechatV1SecureFields.
func (ReceiverV1beta1GooglechatV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1GooglechatV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1JiraV0mimir1Settings struct {
	ApiUrl            string                    `json:"api_url"`
	Project           string                    `json:"project"`
	IssueType         string                    `json:"issue_type"`
	Summary           *string                   `json:"summary,omitempty"`
	Description       *string                   `json:"description,omitempty"`
	Labels            *string                   `json:"labels,omitempty"`
	Priority          *string                   `json:"priority,omitempty"`
	ReopenTransition  *string                   `json:"reopen_transition,omitempty"`
	ResolveTransition *string                   `json:"resolve_transition,omitempty"`
	WontFixResolution *string                   `json:"wont_fix_resolution,omitempty"`
	ReopenDuration    *string                   `json:"reopen_duration,omitempty"`
	Fields            map[string]string         `json:"fields,omitempty"`
	HttpConfig        *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1JiraV0mimir1Settings creates a new ReceiverV1beta1JiraV0mimir1Settings object.
func NewReceiverV1beta1JiraV0mimir1Settings() *ReceiverV1beta1JiraV0mimir1Settings {
	return &ReceiverV1beta1JiraV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1JiraV0mimir1Settings.
func (ReceiverV1beta1JiraV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1JiraV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1JiraV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1JiraV0mimir1SecureFields creates a new ReceiverV1beta1JiraV0mimir1SecureFields object.
func NewReceiverV1beta1JiraV0mimir1SecureFields() *ReceiverV1beta1JiraV0mimir1SecureFields {
	return &ReceiverV1beta1JiraV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1JiraV0mimir1SecureFields.
func (ReceiverV1beta1JiraV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1JiraV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1JiraV1Settings struct {
	ApiUrl            string            `json:"api_url"`
	Project           string            `json:"project"`
	IssueType         string            `json:"issue_type"`
	Summary           *string           `json:"summary,omitempty"`
	Description       *string           `json:"description,omitempty"`
	Labels            *string           `json:"labels,omitempty"`
	Priority          *string           `json:"priority,omitempty"`
	ResolveTransition *string           `json:"resolve_transition,omitempty"`
	ReopenTransition  *string           `json:"reopen_transition,omitempty"`
	ReopenDuration    *string           `json:"reopen_duration,omitempty"`
	WontFixResolution *string           `json:"wont_fix_resolution,omitempty"`
	DedupKeyField     *string           `json:"dedup_key_field,omitempty"`
	Fields            map[string]string `json:"fields,omitempty"`
}

// NewReceiverV1beta1JiraV1Settings creates a new ReceiverV1beta1JiraV1Settings object.
func NewReceiverV1beta1JiraV1Settings() *ReceiverV1beta1JiraV1Settings {
	return &ReceiverV1beta1JiraV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1JiraV1Settings.
func (ReceiverV1beta1JiraV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1JiraV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1JiraV1SecureFields struct {
	ApiToken *bool `json:"api_token,omitempty"`
	Password *bool `json:"password,omitempty"`
	User     *bool `json:"user,omitempty"`
}

// NewReceiverV1beta1JiraV1SecureFields creates a new ReceiverV1beta1JiraV1SecureFields object.
func NewReceiverV1beta1JiraV1SecureFields() *ReceiverV1beta1JiraV1SecureFields {
	return &ReceiverV1beta1JiraV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1JiraV1SecureFields.
func (ReceiverV1beta1JiraV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1JiraV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1KafkaV1Settings struct {
	KafkaRestProxy string                                    `json:"kafkaRestProxy"`
	KafkaTopic     string                                    `json:"kafkaTopic"`
	Username       *string                                   `json:"username,omitempty"`
	ApiVersion     *ReceiverV1beta1KafkaV1SettingsApiVersion `json:"apiVersion,omitempty"`
	KafkaClusterId string                                    `json:"kafkaClusterId"`
	Description    *string                                   `json:"description,omitempty"`
	Details        *string                                   `json:"details,omitempty"`
}

// NewReceiverV1beta1KafkaV1Settings creates a new ReceiverV1beta1KafkaV1Settings object.
func NewReceiverV1beta1KafkaV1Settings() *ReceiverV1beta1KafkaV1Settings {
	return &ReceiverV1beta1KafkaV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1KafkaV1Settings.
func (ReceiverV1beta1KafkaV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1KafkaV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1KafkaV1SecureFields struct {
	Password *bool `json:"password,omitempty"`
}

// NewReceiverV1beta1KafkaV1SecureFields creates a new ReceiverV1beta1KafkaV1SecureFields object.
func NewReceiverV1beta1KafkaV1SecureFields() *ReceiverV1beta1KafkaV1SecureFields {
	return &ReceiverV1beta1KafkaV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1KafkaV1SecureFields.
func (ReceiverV1beta1KafkaV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1KafkaV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1LINEV1Settings struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewReceiverV1beta1LINEV1Settings creates a new ReceiverV1beta1LINEV1Settings object.
func NewReceiverV1beta1LINEV1Settings() *ReceiverV1beta1LINEV1Settings {
	return &ReceiverV1beta1LINEV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1LINEV1Settings.
func (ReceiverV1beta1LINEV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1LINEV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1LINEV1SecureFields struct {
	Token *bool `json:"token,omitempty"`
}

// NewReceiverV1beta1LINEV1SecureFields creates a new ReceiverV1beta1LINEV1SecureFields object.
func NewReceiverV1beta1LINEV1SecureFields() *ReceiverV1beta1LINEV1SecureFields {
	return &ReceiverV1beta1LINEV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1LINEV1SecureFields.
func (ReceiverV1beta1LINEV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1LINEV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1MqttV1Settings struct {
	BrokerUrl     string                                      `json:"brokerUrl"`
	Topic         string                                      `json:"topic"`
	MessageFormat *ReceiverV1beta1MqttV1SettingsMessageFormat `json:"messageFormat,omitempty"`
	ClientId      *string                                     `json:"clientId,omitempty"`
	Message       *string                                     `json:"message,omitempty"`
	Username      *string                                     `json:"username,omitempty"`
	Qos           *ReceiverV1beta1MqttV1SettingsQos           `json:"qos,omitempty"`
	Retain        *bool                                       `json:"retain,omitempty"`
	TlsConfig     *ReceiverGrafanaTLSConfig                   `json:"tlsConfig,omitempty"`
}

// NewReceiverV1beta1MqttV1Settings creates a new ReceiverV1beta1MqttV1Settings object.
func NewReceiverV1beta1MqttV1Settings() *ReceiverV1beta1MqttV1Settings {
	return &ReceiverV1beta1MqttV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1MqttV1Settings.
func (ReceiverV1beta1MqttV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1MqttV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1MqttV1SecureFields struct {
	Password                   *bool `json:"password,omitempty"`
	TlsConfigCaCertificate     *bool `json:"tlsConfig.caCertificate,omitempty"`
	TlsConfigClientCertificate *bool `json:"tlsConfig.clientCertificate,omitempty"`
	TlsConfigClientKey         *bool `json:"tlsConfig.clientKey,omitempty"`
}

// NewReceiverV1beta1MqttV1SecureFields creates a new ReceiverV1beta1MqttV1SecureFields object.
func NewReceiverV1beta1MqttV1SecureFields() *ReceiverV1beta1MqttV1SecureFields {
	return &ReceiverV1beta1MqttV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1MqttV1SecureFields.
func (ReceiverV1beta1MqttV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1MqttV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OncallV1Settings struct {
	Url                 string                                     `json:"url"`
	HttpMethod          *ReceiverV1beta1OncallV1SettingsHttpMethod `json:"httpMethod,omitempty"`
	Username            *string                                    `json:"username,omitempty"`
	AuthorizationScheme *string                                    `json:"authorization_scheme,omitempty"`
	MaxAlerts           *string                                    `json:"maxAlerts,omitempty"`
	Title               *string                                    `json:"title,omitempty"`
	Message             *string                                    `json:"message,omitempty"`
}

// NewReceiverV1beta1OncallV1Settings creates a new ReceiverV1beta1OncallV1Settings object.
func NewReceiverV1beta1OncallV1Settings() *ReceiverV1beta1OncallV1Settings {
	return &ReceiverV1beta1OncallV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OncallV1Settings.
func (ReceiverV1beta1OncallV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OncallV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OncallV1SecureFields struct {
	AuthorizationCredentials *bool `json:"authorization_credentials,omitempty"`
	Password                 *bool `json:"password,omitempty"`
}

// NewReceiverV1beta1OncallV1SecureFields creates a new ReceiverV1beta1OncallV1SecureFields object.
func NewReceiverV1beta1OncallV1SecureFields() *ReceiverV1beta1OncallV1SecureFields {
	return &ReceiverV1beta1OncallV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OncallV1SecureFields.
func (ReceiverV1beta1OncallV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OncallV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OpsgenieV0mimir1Settings struct {
	ApiUrl       string                    `json:"api_url"`
	Message      *string                   `json:"message,omitempty"`
	Description  *string                   `json:"description,omitempty"`
	Source       *string                   `json:"source,omitempty"`
	Details      map[string]string         `json:"details,omitempty"`
	Entity       *string                   `json:"entity,omitempty"`
	Actions      *string                   `json:"actions,omitempty"`
	Tags         *string                   `json:"tags,omitempty"`
	Note         *string                   `json:"note,omitempty"`
	Priority     *string                   `json:"priority,omitempty"`
	UpdateAlerts *bool                     `json:"update_alerts,omitempty"`
	Responders   *string                   `json:"responders,omitempty"`
	HttpConfig   *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1OpsgenieV0mimir1Settings creates a new ReceiverV1beta1OpsgenieV0mimir1Settings object.
func NewReceiverV1beta1OpsgenieV0mimir1Settings() *ReceiverV1beta1OpsgenieV0mimir1Settings {
	return &ReceiverV1beta1OpsgenieV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OpsgenieV0mimir1Settings.
func (ReceiverV1beta1OpsgenieV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OpsgenieV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OpsgenieV0mimir1SecureFields struct {
	ApiKey                             *bool `json:"api_key,omitempty"`
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1OpsgenieV0mimir1SecureFields creates a new ReceiverV1beta1OpsgenieV0mimir1SecureFields object.
func NewReceiverV1beta1OpsgenieV0mimir1SecureFields() *ReceiverV1beta1OpsgenieV0mimir1SecureFields {
	return &ReceiverV1beta1OpsgenieV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OpsgenieV0mimir1SecureFields.
func (ReceiverV1beta1OpsgenieV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OpsgenieV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OpsgenieV1Settings struct {
	ApiUrl           string                                       `json:"apiUrl"`
	Message          *string                                      `json:"message,omitempty"`
	Description      *string                                      `json:"description,omitempty"`
	AutoClose        *bool                                        `json:"autoClose,omitempty"`
	OverridePriority *bool                                        `json:"overridePriority,omitempty"`
	SendTagsAs       *ReceiverV1beta1OpsgenieV1SettingsSendTagsAs `json:"sendTagsAs,omitempty"`
	Responders       *string                                      `json:"responders,omitempty"`
}

// NewReceiverV1beta1OpsgenieV1Settings creates a new ReceiverV1beta1OpsgenieV1Settings object.
func NewReceiverV1beta1OpsgenieV1Settings() *ReceiverV1beta1OpsgenieV1Settings {
	return &ReceiverV1beta1OpsgenieV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OpsgenieV1Settings.
func (ReceiverV1beta1OpsgenieV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OpsgenieV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OpsgenieV1SecureFields struct {
	ApiKey *bool `json:"apiKey,omitempty"`
}

// NewReceiverV1beta1OpsgenieV1SecureFields creates a new ReceiverV1beta1OpsgenieV1SecureFields object.
func NewReceiverV1beta1OpsgenieV1SecureFields() *ReceiverV1beta1OpsgenieV1SecureFields {
	return &ReceiverV1beta1OpsgenieV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OpsgenieV1SecureFields.
func (ReceiverV1beta1OpsgenieV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OpsgenieV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PagerdutyV0mimir1Settings struct {
	Url         string                    `json:"url"`
	Client      *string                   `json:"client,omitempty"`
	ClientUrl   *string                   `json:"client_url,omitempty"`
	Description *string                   `json:"description,omitempty"`
	Details     map[string]string         `json:"details,omitempty"`
	Images      *string                   `json:"images,omitempty"`
	Links       *string                   `json:"links,omitempty"`
	Source      *string                   `json:"source,omitempty"`
	Severity    *string                   `json:"severity,omitempty"`
	Class       *string                   `json:"class,omitempty"`
	Component   *string                   `json:"component,omitempty"`
	Group       *string                   `json:"group,omitempty"`
	HttpConfig  *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1PagerdutyV0mimir1Settings creates a new ReceiverV1beta1PagerdutyV0mimir1Settings object.
func NewReceiverV1beta1PagerdutyV0mimir1Settings() *ReceiverV1beta1PagerdutyV0mimir1Settings {
	return &ReceiverV1beta1PagerdutyV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PagerdutyV0mimir1Settings.
func (ReceiverV1beta1PagerdutyV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PagerdutyV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PagerdutyV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	RoutingKey                         *bool `json:"routing_key,omitempty"`
	ServiceKey                         *bool `json:"service_key,omitempty"`
}

// NewReceiverV1beta1PagerdutyV0mimir1SecureFields creates a new ReceiverV1beta1PagerdutyV0mimir1SecureFields object.
func NewReceiverV1beta1PagerdutyV0mimir1SecureFields() *ReceiverV1beta1PagerdutyV0mimir1SecureFields {
	return &ReceiverV1beta1PagerdutyV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PagerdutyV0mimir1SecureFields.
func (ReceiverV1beta1PagerdutyV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PagerdutyV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PagerdutyV1Settings struct {
	Severity  *string           `json:"severity,omitempty"`
	Class     *string           `json:"class,omitempty"`
	Component *string           `json:"component,omitempty"`
	Group     *string           `json:"group,omitempty"`
	Summary   *string           `json:"summary,omitempty"`
	Source    *string           `json:"source,omitempty"`
	Client    *string           `json:"client,omitempty"`
	ClientUrl *string           `json:"client_url,omitempty"`
	Details   map[string]string `json:"details,omitempty"`
	Url       *string           `json:"url,omitempty"`
}

// NewReceiverV1beta1PagerdutyV1Settings creates a new ReceiverV1beta1PagerdutyV1Settings object.
func NewReceiverV1beta1PagerdutyV1Settings() *ReceiverV1beta1PagerdutyV1Settings {
	return &ReceiverV1beta1PagerdutyV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PagerdutyV1Settings.
func (ReceiverV1beta1PagerdutyV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PagerdutyV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PagerdutyV1SecureFields struct {
	IntegrationKey *bool `json:"integrationKey,omitempty"`
}

// NewReceiverV1beta1PagerdutyV1SecureFields creates a new ReceiverV1beta1PagerdutyV1SecureFields object.
func NewReceiverV1beta1PagerdutyV1SecureFields() *ReceiverV1beta1PagerdutyV1SecureFields {
	return &ReceiverV1beta1PagerdutyV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PagerdutyV1SecureFields.
func (ReceiverV1beta1PagerdutyV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PagerdutyV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PrometheusAlertmanagerV1Settings struct {
	Url           string  `json:"url"`
	BasicAuthUser *string `json:"basicAuthUser,omitempty"`
}

// NewReceiverV1beta1PrometheusAlertmanagerV1Settings creates a new ReceiverV1beta1PrometheusAlertmanagerV1Settings object.
func NewReceiverV1beta1PrometheusAlertmanagerV1Settings() *ReceiverV1beta1PrometheusAlertmanagerV1Settings {
	return &ReceiverV1beta1PrometheusAlertmanagerV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PrometheusAlertmanagerV1Settings.
func (ReceiverV1beta1PrometheusAlertmanagerV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PrometheusAlertmanagerV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PrometheusAlertmanagerV1SecureFields struct {
	BasicAuthPassword *bool `json:"basicAuthPassword,omitempty"`
}

// NewReceiverV1beta1PrometheusAlertmanagerV1SecureFields creates a new ReceiverV1beta1PrometheusAlertmanagerV1SecureFields object.
func NewReceiverV1beta1PrometheusAlertmanagerV1SecureFields() *ReceiverV1beta1PrometheusAlertmanagerV1SecureFields {
	return &ReceiverV1beta1PrometheusAlertmanagerV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PrometheusAlertmanagerV1SecureFields.
func (ReceiverV1beta1PrometheusAlertmanagerV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PrometheusAlertmanagerV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV0mimir1Settings struct {
	Title      *string                   `json:"title,omitempty"`
	Message    *string                   `json:"message,omitempty"`
	Url        *string                   `json:"url,omitempty"`
	UrlTitle   *string                   `json:"url_title,omitempty"`
	Device     *string                   `json:"device,omitempty"`
	Sound      *string                   `json:"sound,omitempty"`
	Priority   *string                   `json:"priority,omitempty"`
	Retry      *string                   `json:"retry,omitempty"`
	Expire     *string                   `json:"expire,omitempty"`
	Ttl        *string                   `json:"ttl,omitempty"`
	Html       *bool                     `json:"html,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1PushoverV0mimir1Settings creates a new ReceiverV1beta1PushoverV0mimir1Settings object.
func NewReceiverV1beta1PushoverV0mimir1Settings() *ReceiverV1beta1PushoverV0mimir1Settings {
	return &ReceiverV1beta1PushoverV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV0mimir1Settings.
func (ReceiverV1beta1PushoverV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	Token                              *bool `json:"token,omitempty"`
	UserKey                            *bool `json:"user_key,omitempty"`
}

// NewReceiverV1beta1PushoverV0mimir1SecureFields creates a new ReceiverV1beta1PushoverV0mimir1SecureFields object.
func NewReceiverV1beta1PushoverV0mimir1SecureFields() *ReceiverV1beta1PushoverV0mimir1SecureFields {
	return &ReceiverV1beta1PushoverV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV0mimir1SecureFields.
func (ReceiverV1beta1PushoverV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV1Settings struct {
	Device     *string                                   `json:"device,omitempty"`
	Priority   *string                                   `json:"priority,omitempty"`
	OkPriority *string                                   `json:"okPriority,omitempty"`
	Retry      *string                                   `json:"retry,omitempty"`
	Expire     *string                                   `json:"expire,omitempty"`
	Sound      *ReceiverV1beta1PushoverV1SettingsSound   `json:"sound,omitempty"`
	OkSound    *ReceiverV1beta1PushoverV1SettingsOkSound `json:"okSound,omitempty"`
	Title      *string                                   `json:"title,omitempty"`
	Message    *string                                   `json:"message,omitempty"`
}

// NewReceiverV1beta1PushoverV1Settings creates a new ReceiverV1beta1PushoverV1Settings object.
func NewReceiverV1beta1PushoverV1Settings() *ReceiverV1beta1PushoverV1Settings {
	return &ReceiverV1beta1PushoverV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV1Settings.
func (ReceiverV1beta1PushoverV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV1SecureFields struct {
	ApiToken *bool `json:"apiToken,omitempty"`
	UserKey  *bool `json:"userKey,omitempty"`
}

// NewReceiverV1beta1PushoverV1SecureFields creates a new ReceiverV1beta1PushoverV1SecureFields object.
func NewReceiverV1beta1PushoverV1SecureFields() *ReceiverV1beta1PushoverV1SecureFields {
	return &ReceiverV1beta1PushoverV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV1SecureFields.
func (ReceiverV1beta1PushoverV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SensugoV1Settings struct {
	Url       string  `json:"url"`
	Entity    *string `json:"entity,omitempty"`
	Check     *string `json:"check,omitempty"`
	Handler   *string `json:"handler,omitempty"`
	Namespace *string `json:"namespace,omitempty"`
	Message   *string `json:"message,omitempty"`
}

// NewReceiverV1beta1SensugoV1Settings creates a new ReceiverV1beta1SensugoV1Settings object.
func NewReceiverV1beta1SensugoV1Settings() *ReceiverV1beta1SensugoV1Settings {
	return &ReceiverV1beta1SensugoV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SensugoV1Settings.
func (ReceiverV1beta1SensugoV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SensugoV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SensugoV1SecureFields struct {
	Apikey *bool `json:"apikey,omitempty"`
}

// NewReceiverV1beta1SensugoV1SecureFields creates a new ReceiverV1beta1SensugoV1SecureFields object.
func NewReceiverV1beta1SensugoV1SecureFields() *ReceiverV1beta1SensugoV1SecureFields {
	return &ReceiverV1beta1SensugoV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SensugoV1SecureFields.
func (ReceiverV1beta1SensugoV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SensugoV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV0mimir1Settings struct {
	Channel     *string                   `json:"channel,omitempty"`
	Username    *string                   `json:"username,omitempty"`
	IconEmoji   *string                   `json:"icon_emoji,omitempty"`
	IconUrl     *string                   `json:"icon_url,omitempty"`
	LinkNames   *bool                     `json:"link_names,omitempty"`
	CallbackId  *string                   `json:"callback_id,omitempty"`
	Color       *string                   `json:"color,omitempty"`
	Fallback    *string                   `json:"fallback,omitempty"`
	Footer      *string                   `json:"footer,omitempty"`
	MrkdwnIn    *string                   `json:"mrkdwn_in,omitempty"`
	Pretext     *string                   `json:"pretext,omitempty"`
	ShortFields *bool                     `json:"short_fields,omitempty"`
	Text        *string                   `json:"text,omitempty"`
	Title       *string                   `json:"title,omitempty"`
	TitleLink   *string                   `json:"title_link,omitempty"`
	ImageUrl    *string                   `json:"image_url,omitempty"`
	ThumbUrl    *string                   `json:"thumb_url,omitempty"`
	Actions     *string                   `json:"actions,omitempty"`
	Fields      *string                   `json:"fields,omitempty"`
	HttpConfig  *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1SlackV0mimir1Settings creates a new ReceiverV1beta1SlackV0mimir1Settings object.
func NewReceiverV1beta1SlackV0mimir1Settings() *ReceiverV1beta1SlackV0mimir1Settings {
	return &ReceiverV1beta1SlackV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackV0mimir1Settings.
func (ReceiverV1beta1SlackV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV0mimir1SecureFields struct {
	ApiUrl                             *bool `json:"api_url,omitempty"`
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1SlackV0mimir1SecureFields creates a new ReceiverV1beta1SlackV0mimir1SecureFields object.
func NewReceiverV1beta1SlackV0mimir1SecureFields() *ReceiverV1beta1SlackV0mimir1SecureFields {
	return &ReceiverV1beta1SlackV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackV0mimir1SecureFields.
func (ReceiverV1beta1SlackV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV1Settings struct {
	Recipient      string                                        `json:"recipient"`
	Username       *string                                       `json:"username,omitempty"`
	IconEmoji      *string                                       `json:"icon_emoji,omitempty"`
	IconUrl        *string                                       `json:"icon_url,omitempty"`
	MentionUsers   *string                                       `json:"mentionUsers,omitempty"`
	MentionGroups  *string                                       `json:"mentionGroups,omitempty"`
	MentionChannel *ReceiverV1beta1SlackV1SettingsMentionChannel `json:"mentionChannel,omitempty"`
	EndpointUrl    *string                                       `json:"endpointUrl,omitempty"`
	Color          *string                                       `json:"color,omitempty"`
	Title          *string                                       `json:"title,omitempty"`
	Text           *string                                       `json:"text,omitempty"`
	Footer         *string                                       `json:"footer,omitempty"`
}

// NewReceiverV1beta1SlackV1Settings creates a new ReceiverV1beta1SlackV1Settings object.
func NewReceiverV1beta1SlackV1Settings() *ReceiverV1beta1SlackV1Settings {
	return &ReceiverV1beta1SlackV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackV1Settings.
func (ReceiverV1beta1SlackV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV1SecureFields struct {
	Token *bool `json:"token,omitempty"`
	Url   *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1SlackV1SecureFields creates a new ReceiverV1beta1SlackV1SecureFields object.
func NewReceiverV1beta1SlackV1SecureFields() *ReceiverV1beta1SlackV1SecureFields {
	return &ReceiverV1beta1SlackV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackV1SecureFields.
func (ReceiverV1beta1SlackV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SnsV0mimir1Settings struct {
	ApiUrl      *string                   `json:"api_url,omitempty"`
	Sigv4       *ReceiverSigv4            `json:"sigv4,omitempty"`
	TopicArn    *string                   `json:"topic_arn,omitempty"`
	PhoneNumber *string                   `json:"phone_number,omitempty"`
	TargetArn   *string                   `json:"target_arn,omitempty"`
	Subject     *string                   `json:"subject,omitempty"`
	Message     *string                   `json:"message,omitempty"`
	Attributes  map[string]string         `json:"attributes,omitempty"`
	HttpConfig  *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1SnsV0mimir1Settings creates a new ReceiverV1beta1SnsV0mimir1Settings object.
func NewReceiverV1beta1SnsV0mimir1Settings() *ReceiverV1beta1SnsV0mimir1Settings {
	return &ReceiverV1beta1SnsV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SnsV0mimir1Settings.
func (ReceiverV1beta1SnsV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SnsV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SnsV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	Sigv4SecretKey                     *bool `json:"sigv4.secret_key,omitempty"`
}

// NewReceiverV1beta1SnsV0mimir1SecureFields creates a new ReceiverV1beta1SnsV0mimir1SecureFields object.
func NewReceiverV1beta1SnsV0mimir1SecureFields() *ReceiverV1beta1SnsV0mimir1SecureFields {
	return &ReceiverV1beta1SnsV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SnsV0mimir1SecureFields.
func (ReceiverV1beta1SnsV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SnsV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SnsV1Settings struct {
	ApiUrl      *string           `json:"api_url,omitempty"`
	Sigv4       *ReceiverSigv4    `json:"sigv4,omitempty"`
	TopicArn    *string           `json:"topic_arn,omitempty"`
	PhoneNumber *string           `json:"phone_number,omitempty"`
	TargetArn   *string           `json:"target_arn,omitempty"`
	Subject     *string           `json:"subject,omitempty"`
	Message     *string           `json:"message,omitempty"`
	Attributes  map[string]string `json:"attributes,omitempty"`
}

// NewReceiverV1beta1SnsV1Settings creates a new ReceiverV1beta1SnsV1Settings object.
func NewReceiverV1beta1SnsV1Settings() *ReceiverV1beta1SnsV1Settings {
	return &ReceiverV1beta1SnsV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SnsV1Settings.
func (ReceiverV1beta1SnsV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SnsV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SnsV1SecureFields struct {
	Sigv4AccessKey *bool `json:"sigv4.access_key,omitempty"`
	Sigv4SecretKey *bool `json:"sigv4.secret_key,omitempty"`
}

// NewReceiverV1beta1SnsV1SecureFields creates a new ReceiverV1beta1SnsV1SecureFields object.
func NewReceiverV1beta1SnsV1SecureFields() *ReceiverV1beta1SnsV1SecureFields {
	return &ReceiverV1beta1SnsV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SnsV1SecureFields.
func (ReceiverV1beta1SnsV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SnsV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TeamsV0mimir1Settings struct {
	Title      *string                   `json:"title,omitempty"`
	Summary    *string                   `json:"summary,omitempty"`
	Text       *string                   `json:"text,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1TeamsV0mimir1Settings creates a new ReceiverV1beta1TeamsV0mimir1Settings object.
func NewReceiverV1beta1TeamsV0mimir1Settings() *ReceiverV1beta1TeamsV0mimir1Settings {
	return &ReceiverV1beta1TeamsV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TeamsV0mimir1Settings.
func (ReceiverV1beta1TeamsV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TeamsV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TeamsV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	WebhookUrl                         *bool `json:"webhook_url,omitempty"`
}

// NewReceiverV1beta1TeamsV0mimir1SecureFields creates a new ReceiverV1beta1TeamsV0mimir1SecureFields object.
func NewReceiverV1beta1TeamsV0mimir1SecureFields() *ReceiverV1beta1TeamsV0mimir1SecureFields {
	return &ReceiverV1beta1TeamsV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TeamsV0mimir1SecureFields.
func (ReceiverV1beta1TeamsV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TeamsV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TeamsV0mimir2Settings struct {
	Title      *string                   `json:"title,omitempty"`
	Text       *string                   `json:"text,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1TeamsV0mimir2Settings creates a new ReceiverV1beta1TeamsV0mimir2Settings object.
func NewReceiverV1beta1TeamsV0mimir2Settings() *ReceiverV1beta1TeamsV0mimir2Settings {
	return &ReceiverV1beta1TeamsV0mimir2Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TeamsV0mimir2Settings.
func (ReceiverV1beta1TeamsV0mimir2Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TeamsV0mimir2Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TeamsV0mimir2SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	WebhookUrl                         *bool `json:"webhook_url,omitempty"`
}

// NewReceiverV1beta1TeamsV0mimir2SecureFields creates a new ReceiverV1beta1TeamsV0mimir2SecureFields object.
func NewReceiverV1beta1TeamsV0mimir2SecureFields() *ReceiverV1beta1TeamsV0mimir2SecureFields {
	return &ReceiverV1beta1TeamsV0mimir2SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TeamsV0mimir2SecureFields.
func (ReceiverV1beta1TeamsV0mimir2SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TeamsV0mimir2SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TeamsV1Settings struct {
	Url          string  `json:"url"`
	Title        *string `json:"title,omitempty"`
	Sectiontitle *string `json:"sectiontitle,omitempty"`
	Message      *string `json:"message,omitempty"`
}

// NewReceiverV1beta1TeamsV1Settings creates a new ReceiverV1beta1TeamsV1Settings object.
func NewReceiverV1beta1TeamsV1Settings() *ReceiverV1beta1TeamsV1Settings {
	return &ReceiverV1beta1TeamsV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TeamsV1Settings.
func (ReceiverV1beta1TeamsV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TeamsV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV0mimir1Settings struct {
	ApiUrl               *string                                           `json:"api_url,omitempty"`
	ChatId               string                                            `json:"chat_id"`
	Message              *string                                           `json:"message,omitempty"`
	DisableNotifications *bool                                             `json:"disable_notifications,omitempty"`
	ParseMode            *ReceiverV1beta1TelegramV0mimir1SettingsParseMode `json:"parse_mode,omitempty"`
	HttpConfig           *ReceiverHTTPClientConfig                         `json:"http_config,omitempty"`
}

// NewReceiverV1beta1TelegramV0mimir1Settings creates a new ReceiverV1beta1TelegramV0mimir1Settings object.
func NewReceiverV1beta1TelegramV0mimir1Settings() *ReceiverV1beta1TelegramV0mimir1Settings {
	return &ReceiverV1beta1TelegramV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV0mimir1Settings.
func (ReceiverV1beta1TelegramV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	Token                              *bool `json:"token,omitempty"`
}

// NewReceiverV1beta1TelegramV0mimir1SecureFields creates a new ReceiverV1beta1TelegramV0mimir1SecureFields object.
func NewReceiverV1beta1TelegramV0mimir1SecureFields() *ReceiverV1beta1TelegramV0mimir1SecureFields {
	return &ReceiverV1beta1TelegramV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV0mimir1SecureFields.
func (ReceiverV1beta1TelegramV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV1Settings struct {
	Chatid                string                                      `json:"chatid"`
	MessageThreadId       *string                                     `json:"message_thread_id,omitempty"`
	Message               *string                                     `json:"message,omitempty"`
	ParseMode             *ReceiverV1beta1TelegramV1SettingsParseMode `json:"parse_mode,omitempty"`
	DisableWebPagePreview *bool                                       `json:"disable_web_page_preview,omitempty"`
	ProtectContent        *bool                                       `json:"protect_content,omitempty"`
	DisableNotifications  *bool                                       `json:"disable_notifications,omitempty"`
}

// NewReceiverV1beta1TelegramV1Settings creates a new ReceiverV1beta1TelegramV1Settings object.
func NewReceiverV1beta1TelegramV1Settings() *ReceiverV1beta1TelegramV1Settings {
	return &ReceiverV1beta1TelegramV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV1Settings.
func (ReceiverV1beta1TelegramV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV1SecureFields struct {
	Bottoken *bool `json:"bottoken,omitempty"`
}

// NewReceiverV1beta1TelegramV1SecureFields creates a new ReceiverV1beta1TelegramV1SecureFields object.
func NewReceiverV1beta1TelegramV1SecureFields() *ReceiverV1beta1TelegramV1SecureFields {
	return &ReceiverV1beta1TelegramV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV1SecureFields.
func (ReceiverV1beta1TelegramV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1ThreemaV1Settings struct {
	GatewayId   string  `json:"gateway_id"`
	RecipientId string  `json:"recipient_id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewReceiverV1beta1ThreemaV1Settings creates a new ReceiverV1beta1ThreemaV1Settings object.
func NewReceiverV1beta1ThreemaV1Settings() *ReceiverV1beta1ThreemaV1Settings {
	return &ReceiverV1beta1ThreemaV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1ThreemaV1Settings.
func (ReceiverV1beta1ThreemaV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1ThreemaV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1ThreemaV1SecureFields struct {
	ApiSecret *bool `json:"api_secret,omitempty"`
}

// NewReceiverV1beta1ThreemaV1SecureFields creates a new ReceiverV1beta1ThreemaV1SecureFields object.
func NewReceiverV1beta1ThreemaV1SecureFields() *ReceiverV1beta1ThreemaV1SecureFields {
	return &ReceiverV1beta1ThreemaV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1ThreemaV1SecureFields.
func (ReceiverV1beta1ThreemaV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1ThreemaV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1VictoropsV0mimir1Settings struct {
	ApiUrl            *string                   `json:"api_url,omitempty"`
	RoutingKey        string                    `json:"routing_key"`
	MessageType       *string                   `json:"message_type,omitempty"`
	EntityDisplayName *string                   `json:"entity_display_name,omitempty"`
	StateMessage      *string                   `json:"state_message,omitempty"`
	MonitoringTool    *string                   `json:"monitoring_tool,omitempty"`
	CustomFields      map[string]string         `json:"custom_fields,omitempty"`
	HttpConfig        *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1VictoropsV0mimir1Settings creates a new ReceiverV1beta1VictoropsV0mimir1Settings object.
func NewReceiverV1beta1VictoropsV0mimir1Settings() *ReceiverV1beta1VictoropsV0mimir1Settings {
	return &ReceiverV1beta1VictoropsV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1VictoropsV0mimir1Settings.
func (ReceiverV1beta1VictoropsV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1VictoropsV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1VictoropsV0mimir1SecureFields struct {
	ApiKey                             *bool `json:"api_key,omitempty"`
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1VictoropsV0mimir1SecureFields creates a new ReceiverV1beta1VictoropsV0mimir1SecureFields object.
func NewReceiverV1beta1VictoropsV0mimir1SecureFields() *ReceiverV1beta1VictoropsV0mimir1SecureFields {
	return &ReceiverV1beta1VictoropsV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1VictoropsV0mimir1SecureFields.
func (ReceiverV1beta1VictoropsV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1VictoropsV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1VictoropsV1Settings struct {
	MessageType *ReceiverV1beta1VictoropsV1SettingsMessageType `json:"messageType,omitempty"`
	Title       *string                                        `json:"title,omitempty"`
	Description *string                                        `json:"description,omitempty"`
}

// NewReceiverV1beta1VictoropsV1Settings creates a new ReceiverV1beta1VictoropsV1Settings object.
func NewReceiverV1beta1VictoropsV1Settings() *ReceiverV1beta1VictoropsV1Settings {
	return &ReceiverV1beta1VictoropsV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1VictoropsV1Settings.
func (ReceiverV1beta1VictoropsV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1VictoropsV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1VictoropsV1SecureFields struct {
	Url *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1VictoropsV1SecureFields creates a new ReceiverV1beta1VictoropsV1SecureFields object.
func NewReceiverV1beta1VictoropsV1SecureFields() *ReceiverV1beta1VictoropsV1SecureFields {
	return &ReceiverV1beta1VictoropsV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1VictoropsV1SecureFields.
func (ReceiverV1beta1VictoropsV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1VictoropsV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebexV0mimir1Settings struct {
	ApiUrl     *string                   `json:"api_url,omitempty"`
	RoomId     string                    `json:"room_id"`
	Message    *string                   `json:"message,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1WebexV0mimir1Settings creates a new ReceiverV1beta1WebexV0mimir1Settings object.
func NewReceiverV1beta1WebexV0mimir1Settings() *ReceiverV1beta1WebexV0mimir1Settings {
	return &ReceiverV1beta1WebexV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebexV0mimir1Settings.
func (ReceiverV1beta1WebexV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebexV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebexV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1WebexV0mimir1SecureFields creates a new ReceiverV1beta1WebexV0mimir1SecureFields object.
func NewReceiverV1beta1WebexV0mimir1SecureFields() *ReceiverV1beta1WebexV0mimir1SecureFields {
	return &ReceiverV1beta1WebexV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebexV0mimir1SecureFields.
func (ReceiverV1beta1WebexV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebexV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebexV1Settings struct {
	ApiUrl  *string `json:"api_url,omitempty"`
	RoomId  string  `json:"room_id"`
	Message *string `json:"message,omitempty"`
}

// NewReceiverV1beta1WebexV1Settings creates a new ReceiverV1beta1WebexV1Settings object.
func NewReceiverV1beta1WebexV1Settings() *ReceiverV1beta1WebexV1Settings {
	return &ReceiverV1beta1WebexV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebexV1Settings.
func (ReceiverV1beta1WebexV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebexV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebexV1SecureFields struct {
	BotToken *bool `json:"bot_token,omitempty"`
}

// NewReceiverV1beta1WebexV1SecureFields creates a new ReceiverV1beta1WebexV1SecureFields object.
func NewReceiverV1beta1WebexV1SecureFields() *ReceiverV1beta1WebexV1SecureFields {
	return &ReceiverV1beta1WebexV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebexV1SecureFields.
func (ReceiverV1beta1WebexV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebexV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV0mimir1Settings struct {
	MaxAlerts  *string                   `json:"max_alerts,omitempty"`
	Timeout    *string                   `json:"timeout,omitempty"`
	HttpConfig *ReceiverHTTPClientConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1WebhookV0mimir1Settings creates a new ReceiverV1beta1WebhookV0mimir1Settings object.
func NewReceiverV1beta1WebhookV0mimir1Settings() *ReceiverV1beta1WebhookV0mimir1Settings {
	return &ReceiverV1beta1WebhookV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV0mimir1Settings.
func (ReceiverV1beta1WebhookV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV0mimir1SecureFields struct {
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
	Url                                *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1WebhookV0mimir1SecureFields creates a new ReceiverV1beta1WebhookV0mimir1SecureFields object.
func NewReceiverV1beta1WebhookV0mimir1SecureFields() *ReceiverV1beta1WebhookV0mimir1SecureFields {
	return &ReceiverV1beta1WebhookV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV0mimir1SecureFields.
func (ReceiverV1beta1WebhookV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsPayload struct {
	Template string            `json:"template"`
	Vars     map[string]string `json:"vars,omitempty"`
}

// NewReceiverV1beta1WebhookV1SettingsPayload creates a new ReceiverV1beta1WebhookV1SettingsPayload object.
func NewReceiverV1beta1WebhookV1SettingsPayload() *ReceiverV1beta1WebhookV1SettingsPayload {
	return &ReceiverV1beta1WebhookV1SettingsPayload{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsPayload.
func (ReceiverV1beta1WebhookV1SettingsPayload) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsPayload"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsHmacConfig struct {
	Header          *string `json:"header,omitempty"`
	TimestampHeader *string `json:"timestampHeader,omitempty"`
}

// NewReceiverV1beta1WebhookV1SettingsHmacConfig creates a new ReceiverV1beta1WebhookV1SettingsHmacConfig object.
func NewReceiverV1beta1WebhookV1SettingsHmacConfig() *ReceiverV1beta1WebhookV1SettingsHmacConfig {
	return &ReceiverV1beta1WebhookV1SettingsHmacConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsHmacConfig.
func (ReceiverV1beta1WebhookV1SettingsHmacConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsHmacConfig"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig struct {
	ProxyUrl             *string           `json:"proxy_url,omitempty"`
	ProxyFromEnvironment *bool             `json:"proxy_from_environment,omitempty"`
	NoProxy              *string           `json:"no_proxy,omitempty"`
	ProxyConnectHeader   map[string]string `json:"proxy_connect_header,omitempty"`
}

// NewReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig creates a new ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig object.
func NewReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig() *ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig {
	return &ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig.
func (ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2 struct {
	TokenUrl       string                                                       `json:"token_url"`
	ClientId       string                                                       `json:"client_id"`
	Scopes         *string                                                      `json:"scopes,omitempty"`
	EndpointParams map[string]string                                            `json:"endpoint_params,omitempty"`
	TlsConfig      *ReceiverGrafanaTLSConfig                                    `json:"tls_config,omitempty"`
	ProxyConfig    *ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2ProxyConfig `json:"proxy_config,omitempty"`
}

// NewReceiverV1beta1WebhookV1SettingsHttpConfigOauth2 creates a new ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2 object.
func NewReceiverV1beta1WebhookV1SettingsHttpConfigOauth2() *ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2 {
	return &ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2.
func (ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsHttpConfig struct {
	Oauth2 *ReceiverV1beta1WebhookV1SettingsHttpConfigOauth2 `json:"oauth2,omitempty"`
}

// NewReceiverV1beta1WebhookV1SettingsHttpConfig creates a new ReceiverV1beta1WebhookV1SettingsHttpConfig object.
func NewReceiverV1beta1WebhookV1SettingsHttpConfig() *ReceiverV1beta1WebhookV1SettingsHttpConfig {
	return &ReceiverV1beta1WebhookV1SettingsHttpConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsHttpConfig.
func (ReceiverV1beta1WebhookV1SettingsHttpConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsHttpConfig"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1Settings struct {
	Url                 string                                      `json:"url"`
	HttpMethod          *ReceiverV1beta1WebhookV1SettingsHttpMethod `json:"httpMethod,omitempty"`
	Username            *string                                     `json:"username,omitempty"`
	AuthorizationScheme *string                                     `json:"authorization_scheme,omitempty"`
	Headers             map[string]string                           `json:"headers,omitempty"`
	MaxAlerts           *string                                     `json:"maxAlerts,omitempty"`
	Title               *string                                     `json:"title,omitempty"`
	Message             *string                                     `json:"message,omitempty"`
	Payload             *ReceiverV1beta1WebhookV1SettingsPayload    `json:"payload,omitempty"`
	TlsConfig           *ReceiverGrafanaTLSConfig                   `json:"tlsConfig,omitempty"`
	HmacConfig          *ReceiverV1beta1WebhookV1SettingsHmacConfig `json:"hmacConfig,omitempty"`
	HttpConfig          *ReceiverV1beta1WebhookV1SettingsHttpConfig `json:"http_config,omitempty"`
}

// NewReceiverV1beta1WebhookV1Settings creates a new ReceiverV1beta1WebhookV1Settings object.
func NewReceiverV1beta1WebhookV1Settings() *ReceiverV1beta1WebhookV1Settings {
	return &ReceiverV1beta1WebhookV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1Settings.
func (ReceiverV1beta1WebhookV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SecureFields struct {
	AuthorizationCredentials                   *bool `json:"authorization_credentials,omitempty"`
	HmacConfigSecret                           *bool `json:"hmacConfig.secret,omitempty"`
	HttpConfigOauth2ClientSecret               *bool `json:"http_config.oauth2.client_secret,omitempty"`
	HttpConfigOauth2TlsConfigCaCertificate     *bool `json:"http_config.oauth2.tls_config.caCertificate,omitempty"`
	HttpConfigOauth2TlsConfigClientCertificate *bool `json:"http_config.oauth2.tls_config.clientCertificate,omitempty"`
	HttpConfigOauth2TlsConfigClientKey         *bool `json:"http_config.oauth2.tls_config.clientKey,omitempty"`
	Password                                   *bool `json:"password,omitempty"`
	TlsConfigCaCertificate                     *bool `json:"tlsConfig.caCertificate,omitempty"`
	TlsConfigClientCertificate                 *bool `json:"tlsConfig.clientCertificate,omitempty"`
	TlsConfigClientKey                         *bool `json:"tlsConfig.clientKey,omitempty"`
}

// NewReceiverV1beta1WebhookV1SecureFields creates a new ReceiverV1beta1WebhookV1SecureFields object.
func NewReceiverV1beta1WebhookV1SecureFields() *ReceiverV1beta1WebhookV1SecureFields {
	return &ReceiverV1beta1WebhookV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SecureFields.
func (ReceiverV1beta1WebhookV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WechatV0mimir1Settings struct {
	ApiUrl      *string                                           `json:"api_url,omitempty"`
	CorpId      *string                                           `json:"corp_id,omitempty"`
	Message     *string                                           `json:"message,omitempty"`
	MessageType *ReceiverV1beta1WechatV0mimir1SettingsMessageType `json:"message_type,omitempty"`
	AgentId     *string                                           `json:"agent_id,omitempty"`
	ToUser      *string                                           `json:"to_user,omitempty"`
	ToParty     *string                                           `json:"to_party,omitempty"`
	ToTag       *string                                           `json:"to_tag,omitempty"`
	HttpConfig  *ReceiverHTTPClientConfig                         `json:"http_config,omitempty"`
}

// NewReceiverV1beta1WechatV0mimir1Settings creates a new ReceiverV1beta1WechatV0mimir1Settings object.
func NewReceiverV1beta1WechatV0mimir1Settings() *ReceiverV1beta1WechatV0mimir1Settings {
	return &ReceiverV1beta1WechatV0mimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WechatV0mimir1Settings.
func (ReceiverV1beta1WechatV0mimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WechatV0mimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WechatV0mimir1SecureFields struct {
	ApiSecret                          *bool `json:"api_secret,omitempty"`
	HttpConfigAuthorizationCredentials *bool `json:"http_config.authorization.credentials,omitempty"`
	HttpConfigBasicAuthPassword        *bool `json:"http_config.basic_auth.password,omitempty"`
	HttpConfigOauth2ClientSecret       *bool `json:"http_config.oauth2.client_secret,omitempty"`
}

// NewReceiverV1beta1WechatV0mimir1SecureFields creates a new ReceiverV1beta1WechatV0mimir1SecureFields object.
func NewReceiverV1beta1WechatV0mimir1SecureFields() *ReceiverV1beta1WechatV0mimir1SecureFields {
	return &ReceiverV1beta1WechatV0mimir1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WechatV0mimir1SecureFields.
func (ReceiverV1beta1WechatV0mimir1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WechatV0mimir1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WecomV1Settings struct {
	AgentId string                                 `json:"agent_id"`
	CorpId  string                                 `json:"corp_id"`
	Msgtype *ReceiverV1beta1WecomV1SettingsMsgtype `json:"msgtype,omitempty"`
	Message *string                                `json:"message,omitempty"`
	Title   *string                                `json:"title,omitempty"`
	Touser  *string                                `json:"touser,omitempty"`
}

// NewReceiverV1beta1WecomV1Settings creates a new ReceiverV1beta1WecomV1Settings object.
func NewReceiverV1beta1WecomV1Settings() *ReceiverV1beta1WecomV1Settings {
	return &ReceiverV1beta1WecomV1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WecomV1Settings.
func (ReceiverV1beta1WecomV1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WecomV1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WecomV1SecureFields struct {
	Secret *bool `json:"secret,omitempty"`
	Url    *bool `json:"url,omitempty"`
}

// NewReceiverV1beta1WecomV1SecureFields creates a new ReceiverV1beta1WecomV1SecureFields object.
func NewReceiverV1beta1WecomV1SecureFields() *ReceiverV1beta1WecomV1SecureFields {
	return &ReceiverV1beta1WecomV1SecureFields{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WecomV1SecureFields.
func (ReceiverV1beta1WecomV1SecureFields) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WecomV1SecureFields"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1DingdingV1SettingsMsgType string

const (
	ReceiverV1beta1DingdingV1SettingsMsgTypeLink       ReceiverV1beta1DingdingV1SettingsMsgType = "link"
	ReceiverV1beta1DingdingV1SettingsMsgTypeActionCard ReceiverV1beta1DingdingV1SettingsMsgType = "actionCard"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1DingdingV1SettingsMsgType.
func (ReceiverV1beta1DingdingV1SettingsMsgType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1DingdingV1SettingsMsgType"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1KafkaV1SettingsApiVersion string

const (
	ReceiverV1beta1KafkaV1SettingsApiVersionV2 ReceiverV1beta1KafkaV1SettingsApiVersion = "v2"
	ReceiverV1beta1KafkaV1SettingsApiVersionV3 ReceiverV1beta1KafkaV1SettingsApiVersion = "v3"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1KafkaV1SettingsApiVersion.
func (ReceiverV1beta1KafkaV1SettingsApiVersion) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1KafkaV1SettingsApiVersion"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1MqttV1SettingsMessageFormat string

const (
	ReceiverV1beta1MqttV1SettingsMessageFormatJson ReceiverV1beta1MqttV1SettingsMessageFormat = "json"
	ReceiverV1beta1MqttV1SettingsMessageFormatText ReceiverV1beta1MqttV1SettingsMessageFormat = "text"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1MqttV1SettingsMessageFormat.
func (ReceiverV1beta1MqttV1SettingsMessageFormat) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1MqttV1SettingsMessageFormat"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1MqttV1SettingsQos string

const (
	ReceiverV1beta1MqttV1SettingsQos0 ReceiverV1beta1MqttV1SettingsQos = "0"
	ReceiverV1beta1MqttV1SettingsQos1 ReceiverV1beta1MqttV1SettingsQos = "1"
	ReceiverV1beta1MqttV1SettingsQos2 ReceiverV1beta1MqttV1SettingsQos = "2"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1MqttV1SettingsQos.
func (ReceiverV1beta1MqttV1SettingsQos) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1MqttV1SettingsQos"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OncallV1SettingsHttpMethod string

const (
	ReceiverV1beta1OncallV1SettingsHttpMethodPOST ReceiverV1beta1OncallV1SettingsHttpMethod = "POST"
	ReceiverV1beta1OncallV1SettingsHttpMethodPUT  ReceiverV1beta1OncallV1SettingsHttpMethod = "PUT"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OncallV1SettingsHttpMethod.
func (ReceiverV1beta1OncallV1SettingsHttpMethod) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OncallV1SettingsHttpMethod"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1OpsgenieV1SettingsSendTagsAs string

const (
	ReceiverV1beta1OpsgenieV1SettingsSendTagsAsTags    ReceiverV1beta1OpsgenieV1SettingsSendTagsAs = "tags"
	ReceiverV1beta1OpsgenieV1SettingsSendTagsAsDetails ReceiverV1beta1OpsgenieV1SettingsSendTagsAs = "details"
	ReceiverV1beta1OpsgenieV1SettingsSendTagsAsBoth    ReceiverV1beta1OpsgenieV1SettingsSendTagsAs = "both"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1OpsgenieV1SettingsSendTagsAs.
func (ReceiverV1beta1OpsgenieV1SettingsSendTagsAs) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1OpsgenieV1SettingsSendTagsAs"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV1SettingsSound string

const (
	ReceiverV1beta1PushoverV1SettingsSoundDefault      ReceiverV1beta1PushoverV1SettingsSound = "default"
	ReceiverV1beta1PushoverV1SettingsSoundPushover     ReceiverV1beta1PushoverV1SettingsSound = "pushover"
	ReceiverV1beta1PushoverV1SettingsSoundBike         ReceiverV1beta1PushoverV1SettingsSound = "bike"
	ReceiverV1beta1PushoverV1SettingsSoundBugle        ReceiverV1beta1PushoverV1SettingsSound = "bugle"
	ReceiverV1beta1PushoverV1SettingsSoundCashregister ReceiverV1beta1PushoverV1SettingsSound = "cashregister"
	ReceiverV1beta1PushoverV1SettingsSoundClassical    ReceiverV1beta1PushoverV1SettingsSound = "classical"
	ReceiverV1beta1PushoverV1SettingsSoundCosmic       ReceiverV1beta1PushoverV1SettingsSound = "cosmic"
	ReceiverV1beta1PushoverV1SettingsSoundFalling      ReceiverV1beta1PushoverV1SettingsSound = "falling"
	ReceiverV1beta1PushoverV1SettingsSoundGamelan      ReceiverV1beta1PushoverV1SettingsSound = "gamelan"
	ReceiverV1beta1PushoverV1SettingsSoundIncoming     ReceiverV1beta1PushoverV1SettingsSound = "incoming"
	ReceiverV1beta1PushoverV1SettingsSoundIntermission ReceiverV1beta1PushoverV1SettingsSound = "intermission"
	ReceiverV1beta1PushoverV1SettingsSoundMagic        ReceiverV1beta1PushoverV1SettingsSound = "magic"
	ReceiverV1beta1PushoverV1SettingsSoundMechanical   ReceiverV1beta1PushoverV1SettingsSound = "mechanical"
	ReceiverV1beta1PushoverV1SettingsSoundPianobar     ReceiverV1beta1PushoverV1SettingsSound = "pianobar"
	ReceiverV1beta1PushoverV1SettingsSoundSiren        ReceiverV1beta1PushoverV1SettingsSound = "siren"
	ReceiverV1beta1PushoverV1SettingsSoundSpacealarm   ReceiverV1beta1PushoverV1SettingsSound = "spacealarm"
	ReceiverV1beta1PushoverV1SettingsSoundTugboat      ReceiverV1beta1PushoverV1SettingsSound = "tugboat"
	ReceiverV1beta1PushoverV1SettingsSoundAlien        ReceiverV1beta1PushoverV1SettingsSound = "alien"
	ReceiverV1beta1PushoverV1SettingsSoundClimb        ReceiverV1beta1PushoverV1SettingsSound = "climb"
	ReceiverV1beta1PushoverV1SettingsSoundPersistent   ReceiverV1beta1PushoverV1SettingsSound = "persistent"
	ReceiverV1beta1PushoverV1SettingsSoundEcho         ReceiverV1beta1PushoverV1SettingsSound = "echo"
	ReceiverV1beta1PushoverV1SettingsSoundUpdown       ReceiverV1beta1PushoverV1SettingsSound = "updown"
	ReceiverV1beta1PushoverV1SettingsSoundNone         ReceiverV1beta1PushoverV1SettingsSound = "none"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV1SettingsSound.
func (ReceiverV1beta1PushoverV1SettingsSound) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV1SettingsSound"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1PushoverV1SettingsOkSound string

const (
	ReceiverV1beta1PushoverV1SettingsOkSoundDefault      ReceiverV1beta1PushoverV1SettingsOkSound = "default"
	ReceiverV1beta1PushoverV1SettingsOkSoundPushover     ReceiverV1beta1PushoverV1SettingsOkSound = "pushover"
	ReceiverV1beta1PushoverV1SettingsOkSoundBike         ReceiverV1beta1PushoverV1SettingsOkSound = "bike"
	ReceiverV1beta1PushoverV1SettingsOkSoundBugle        ReceiverV1beta1PushoverV1SettingsOkSound = "bugle"
	ReceiverV1beta1PushoverV1SettingsOkSoundCashregister ReceiverV1beta1PushoverV1SettingsOkSound = "cashregister"
	ReceiverV1beta1PushoverV1SettingsOkSoundClassical    ReceiverV1beta1PushoverV1SettingsOkSound = "classical"
	ReceiverV1beta1PushoverV1SettingsOkSoundCosmic       ReceiverV1beta1PushoverV1SettingsOkSound = "cosmic"
	ReceiverV1beta1PushoverV1SettingsOkSoundFalling      ReceiverV1beta1PushoverV1SettingsOkSound = "falling"
	ReceiverV1beta1PushoverV1SettingsOkSoundGamelan      ReceiverV1beta1PushoverV1SettingsOkSound = "gamelan"
	ReceiverV1beta1PushoverV1SettingsOkSoundIncoming     ReceiverV1beta1PushoverV1SettingsOkSound = "incoming"
	ReceiverV1beta1PushoverV1SettingsOkSoundIntermission ReceiverV1beta1PushoverV1SettingsOkSound = "intermission"
	ReceiverV1beta1PushoverV1SettingsOkSoundMagic        ReceiverV1beta1PushoverV1SettingsOkSound = "magic"
	ReceiverV1beta1PushoverV1SettingsOkSoundMechanical   ReceiverV1beta1PushoverV1SettingsOkSound = "mechanical"
	ReceiverV1beta1PushoverV1SettingsOkSoundPianobar     ReceiverV1beta1PushoverV1SettingsOkSound = "pianobar"
	ReceiverV1beta1PushoverV1SettingsOkSoundSiren        ReceiverV1beta1PushoverV1SettingsOkSound = "siren"
	ReceiverV1beta1PushoverV1SettingsOkSoundSpacealarm   ReceiverV1beta1PushoverV1SettingsOkSound = "spacealarm"
	ReceiverV1beta1PushoverV1SettingsOkSoundTugboat      ReceiverV1beta1PushoverV1SettingsOkSound = "tugboat"
	ReceiverV1beta1PushoverV1SettingsOkSoundAlien        ReceiverV1beta1PushoverV1SettingsOkSound = "alien"
	ReceiverV1beta1PushoverV1SettingsOkSoundClimb        ReceiverV1beta1PushoverV1SettingsOkSound = "climb"
	ReceiverV1beta1PushoverV1SettingsOkSoundPersistent   ReceiverV1beta1PushoverV1SettingsOkSound = "persistent"
	ReceiverV1beta1PushoverV1SettingsOkSoundEcho         ReceiverV1beta1PushoverV1SettingsOkSound = "echo"
	ReceiverV1beta1PushoverV1SettingsOkSoundUpdown       ReceiverV1beta1PushoverV1SettingsOkSound = "updown"
	ReceiverV1beta1PushoverV1SettingsOkSoundNone         ReceiverV1beta1PushoverV1SettingsOkSound = "none"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1PushoverV1SettingsOkSound.
func (ReceiverV1beta1PushoverV1SettingsOkSound) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1PushoverV1SettingsOkSound"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV1SettingsMentionChannel string

const (
	ReceiverV1beta1SlackV1SettingsMentionChannelHere    ReceiverV1beta1SlackV1SettingsMentionChannel = "here"
	ReceiverV1beta1SlackV1SettingsMentionChannelChannel ReceiverV1beta1SlackV1SettingsMentionChannel = "channel"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackV1SettingsMentionChannel.
func (ReceiverV1beta1SlackV1SettingsMentionChannel) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackV1SettingsMentionChannel"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV0mimir1SettingsParseMode string

const (
	ReceiverV1beta1TelegramV0mimir1SettingsParseModeMarkdownV2 ReceiverV1beta1TelegramV0mimir1SettingsParseMode = "MarkdownV2"
	ReceiverV1beta1TelegramV0mimir1SettingsParseModeMarkdown   ReceiverV1beta1TelegramV0mimir1SettingsParseMode = "Markdown"
	ReceiverV1beta1TelegramV0mimir1SettingsParseModeHTML       ReceiverV1beta1TelegramV0mimir1SettingsParseMode = "HTML"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV0mimir1SettingsParseMode.
func (ReceiverV1beta1TelegramV0mimir1SettingsParseMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV0mimir1SettingsParseMode"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1TelegramV1SettingsParseMode string

const (
	ReceiverV1beta1TelegramV1SettingsParseModeNone       ReceiverV1beta1TelegramV1SettingsParseMode = "None"
	ReceiverV1beta1TelegramV1SettingsParseModeHTML       ReceiverV1beta1TelegramV1SettingsParseMode = "HTML"
	ReceiverV1beta1TelegramV1SettingsParseModeMarkdown   ReceiverV1beta1TelegramV1SettingsParseMode = "Markdown"
	ReceiverV1beta1TelegramV1SettingsParseModeMarkdownV2 ReceiverV1beta1TelegramV1SettingsParseMode = "MarkdownV2"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1TelegramV1SettingsParseMode.
func (ReceiverV1beta1TelegramV1SettingsParseMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1TelegramV1SettingsParseMode"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1VictoropsV1SettingsMessageType string

const (
	ReceiverV1beta1VictoropsV1SettingsMessageTypeCRITICAL ReceiverV1beta1VictoropsV1SettingsMessageType = "CRITICAL"
	ReceiverV1beta1VictoropsV1SettingsMessageTypeWARNING  ReceiverV1beta1VictoropsV1SettingsMessageType = "WARNING"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1VictoropsV1SettingsMessageType.
func (ReceiverV1beta1VictoropsV1SettingsMessageType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1VictoropsV1SettingsMessageType"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1SettingsHttpMethod string

const (
	ReceiverV1beta1WebhookV1SettingsHttpMethodPOST ReceiverV1beta1WebhookV1SettingsHttpMethod = "POST"
	ReceiverV1beta1WebhookV1SettingsHttpMethodPUT  ReceiverV1beta1WebhookV1SettingsHttpMethod = "PUT"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WebhookV1SettingsHttpMethod.
func (ReceiverV1beta1WebhookV1SettingsHttpMethod) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WebhookV1SettingsHttpMethod"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WechatV0mimir1SettingsMessageType string

const (
	ReceiverV1beta1WechatV0mimir1SettingsMessageTypeText     ReceiverV1beta1WechatV0mimir1SettingsMessageType = "text"
	ReceiverV1beta1WechatV0mimir1SettingsMessageTypeMarkdown ReceiverV1beta1WechatV0mimir1SettingsMessageType = "markdown"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WechatV0mimir1SettingsMessageType.
func (ReceiverV1beta1WechatV0mimir1SettingsMessageType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WechatV0mimir1SettingsMessageType"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WecomV1SettingsMsgtype string

const (
	ReceiverV1beta1WecomV1SettingsMsgtypeText     ReceiverV1beta1WecomV1SettingsMsgtype = "text"
	ReceiverV1beta1WecomV1SettingsMsgtypeMarkdown ReceiverV1beta1WecomV1SettingsMsgtype = "markdown"
)

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1WecomV1SettingsMsgtype.
func (ReceiverV1beta1WecomV1SettingsMsgtype) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1WecomV1SettingsMsgtype"
}

// +k8s:openapi-gen=true
type ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1 struct {
	DingdingV1               *ReceiverDingdingV1               `json:"DingdingV1,omitempty"`
	DiscordV0mimir1          *ReceiverDiscordV0mimir1          `json:"DiscordV0mimir1,omitempty"`
	DiscordV1                *ReceiverDiscordV1                `json:"DiscordV1,omitempty"`
	EmailV0mimir1            *ReceiverEmailV0mimir1            `json:"EmailV0mimir1,omitempty"`
	EmailV1                  *ReceiverEmailV1                  `json:"EmailV1,omitempty"`
	GooglechatV1             *ReceiverGooglechatV1             `json:"GooglechatV1,omitempty"`
	JiraV0mimir1             *ReceiverJiraV0mimir1             `json:"JiraV0mimir1,omitempty"`
	JiraV1                   *ReceiverJiraV1                   `json:"JiraV1,omitempty"`
	KafkaV1                  *ReceiverKafkaV1                  `json:"KafkaV1,omitempty"`
	LINEV1                   *ReceiverLINEV1                   `json:"LINEV1,omitempty"`
	MqttV1                   *ReceiverMqttV1                   `json:"MqttV1,omitempty"`
	OncallV1                 *ReceiverOncallV1                 `json:"OncallV1,omitempty"`
	OpsgenieV0mimir1         *ReceiverOpsgenieV0mimir1         `json:"OpsgenieV0mimir1,omitempty"`
	OpsgenieV1               *ReceiverOpsgenieV1               `json:"OpsgenieV1,omitempty"`
	PagerdutyV0mimir1        *ReceiverPagerdutyV0mimir1        `json:"PagerdutyV0mimir1,omitempty"`
	PagerdutyV1              *ReceiverPagerdutyV1              `json:"PagerdutyV1,omitempty"`
	PrometheusAlertmanagerV1 *ReceiverPrometheusAlertmanagerV1 `json:"PrometheusAlertmanagerV1,omitempty"`
	PushoverV0mimir1         *ReceiverPushoverV0mimir1         `json:"PushoverV0mimir1,omitempty"`
	PushoverV1               *ReceiverPushoverV1               `json:"PushoverV1,omitempty"`
	SensugoV1                *ReceiverSensugoV1                `json:"SensugoV1,omitempty"`
	SlackV0mimir1            *ReceiverSlackV0mimir1            `json:"SlackV0mimir1,omitempty"`
	SlackV1                  *ReceiverSlackV1                  `json:"SlackV1,omitempty"`
	SnsV0mimir1              *ReceiverSnsV0mimir1              `json:"SnsV0mimir1,omitempty"`
	SnsV1                    *ReceiverSnsV1                    `json:"SnsV1,omitempty"`
	TeamsV0mimir1            *ReceiverTeamsV0mimir1            `json:"TeamsV0mimir1,omitempty"`
	TeamsV0mimir2            *ReceiverTeamsV0mimir2            `json:"TeamsV0mimir2,omitempty"`
	TeamsV1                  *ReceiverTeamsV1                  `json:"TeamsV1,omitempty"`
	TelegramV0mimir1         *ReceiverTelegramV0mimir1         `json:"TelegramV0mimir1,omitempty"`
	TelegramV1               *ReceiverTelegramV1               `json:"TelegramV1,omitempty"`
	ThreemaV1                *ReceiverThreemaV1                `json:"ThreemaV1,omitempty"`
	VictoropsV0mimir1        *ReceiverVictoropsV0mimir1        `json:"VictoropsV0mimir1,omitempty"`
	VictoropsV1              *ReceiverVictoropsV1              `json:"VictoropsV1,omitempty"`
	WebexV0mimir1            *ReceiverWebexV0mimir1            `json:"WebexV0mimir1,omitempty"`
	WebexV1                  *ReceiverWebexV1                  `json:"WebexV1,omitempty"`
	WebhookV0mimir1          *ReceiverWebhookV0mimir1          `json:"WebhookV0mimir1,omitempty"`
	WebhookV1                *ReceiverWebhookV1                `json:"WebhookV1,omitempty"`
	WechatV0mimir1           *ReceiverWechatV0mimir1           `json:"WechatV0mimir1,omitempty"`
	WecomV1                  *ReceiverWecomV1                  `json:"WecomV1,omitempty"`
}

// NewReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1 creates a new ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1 object.
func NewReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1() *ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1 {
	return &ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1` as JSON.
func (resource ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1) MarshalJSON() ([]byte, error) {
	if resource.DingdingV1 != nil {
		return json.Marshal(resource.DingdingV1)
	}
	if resource.DiscordV0mimir1 != nil {
		return json.Marshal(resource.DiscordV0mimir1)
	}
	if resource.DiscordV1 != nil {
		return json.Marshal(resource.DiscordV1)
	}
	if resource.EmailV0mimir1 != nil {
		return json.Marshal(resource.EmailV0mimir1)
	}
	if resource.EmailV1 != nil {
		return json.Marshal(resource.EmailV1)
	}
	if resource.GooglechatV1 != nil {
		return json.Marshal(resource.GooglechatV1)
	}
	if resource.JiraV0mimir1 != nil {
		return json.Marshal(resource.JiraV0mimir1)
	}
	if resource.JiraV1 != nil {
		return json.Marshal(resource.JiraV1)
	}
	if resource.KafkaV1 != nil {
		return json.Marshal(resource.KafkaV1)
	}
	if resource.LINEV1 != nil {
		return json.Marshal(resource.LINEV1)
	}
	if resource.MqttV1 != nil {
		return json.Marshal(resource.MqttV1)
	}
	if resource.OncallV1 != nil {
		return json.Marshal(resource.OncallV1)
	}
	if resource.OpsgenieV0mimir1 != nil {
		return json.Marshal(resource.OpsgenieV0mimir1)
	}
	if resource.OpsgenieV1 != nil {
		return json.Marshal(resource.OpsgenieV1)
	}
	if resource.PagerdutyV0mimir1 != nil {
		return json.Marshal(resource.PagerdutyV0mimir1)
	}
	if resource.PagerdutyV1 != nil {
		return json.Marshal(resource.PagerdutyV1)
	}
	if resource.PrometheusAlertmanagerV1 != nil {
		return json.Marshal(resource.PrometheusAlertmanagerV1)
	}
	if resource.PushoverV0mimir1 != nil {
		return json.Marshal(resource.PushoverV0mimir1)
	}
	if resource.PushoverV1 != nil {
		return json.Marshal(resource.PushoverV1)
	}
	if resource.SensugoV1 != nil {
		return json.Marshal(resource.SensugoV1)
	}
	if resource.SlackV0mimir1 != nil {
		return json.Marshal(resource.SlackV0mimir1)
	}
	if resource.SlackV1 != nil {
		return json.Marshal(resource.SlackV1)
	}
	if resource.SnsV0mimir1 != nil {
		return json.Marshal(resource.SnsV0mimir1)
	}
	if resource.SnsV1 != nil {
		return json.Marshal(resource.SnsV1)
	}
	if resource.TeamsV0mimir1 != nil {
		return json.Marshal(resource.TeamsV0mimir1)
	}
	if resource.TeamsV0mimir2 != nil {
		return json.Marshal(resource.TeamsV0mimir2)
	}
	if resource.TeamsV1 != nil {
		return json.Marshal(resource.TeamsV1)
	}
	if resource.TelegramV0mimir1 != nil {
		return json.Marshal(resource.TelegramV0mimir1)
	}
	if resource.TelegramV1 != nil {
		return json.Marshal(resource.TelegramV1)
	}
	if resource.ThreemaV1 != nil {
		return json.Marshal(resource.ThreemaV1)
	}
	if resource.VictoropsV0mimir1 != nil {
		return json.Marshal(resource.VictoropsV0mimir1)
	}
	if resource.VictoropsV1 != nil {
		return json.Marshal(resource.VictoropsV1)
	}
	if resource.WebexV0mimir1 != nil {
		return json.Marshal(resource.WebexV0mimir1)
	}
	if resource.WebexV1 != nil {
		return json.Marshal(resource.WebexV1)
	}
	if resource.WebhookV0mimir1 != nil {
		return json.Marshal(resource.WebhookV0mimir1)
	}
	if resource.WebhookV1 != nil {
		return json.Marshal(resource.WebhookV1)
	}
	if resource.WechatV0mimir1 != nil {
		return json.Marshal(resource.WechatV0mimir1)
	}
	if resource.WecomV1 != nil {
		return json.Marshal(resource.WecomV1)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1` from JSON.
func (resource *ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["variant"]
	if !found {
		return nil
	}

	switch discriminator {
	case "LINE/v1":
		var receiverLINEV1 ReceiverLINEV1
		if err := json.Unmarshal(raw, &receiverLINEV1); err != nil {
			return err
		}

		resource.LINEV1 = &receiverLINEV1
		return nil
	case "dingding/v1":
		var receiverDingdingV1 ReceiverDingdingV1
		if err := json.Unmarshal(raw, &receiverDingdingV1); err != nil {
			return err
		}

		resource.DingdingV1 = &receiverDingdingV1
		return nil
	case "discord/v0mimir1":
		var receiverDiscordV0mimir1 ReceiverDiscordV0mimir1
		if err := json.Unmarshal(raw, &receiverDiscordV0mimir1); err != nil {
			return err
		}

		resource.DiscordV0mimir1 = &receiverDiscordV0mimir1
		return nil
	case "discord/v1":
		var receiverDiscordV1 ReceiverDiscordV1
		if err := json.Unmarshal(raw, &receiverDiscordV1); err != nil {
			return err
		}

		resource.DiscordV1 = &receiverDiscordV1
		return nil
	case "email/v0mimir1":
		var receiverEmailV0mimir1 ReceiverEmailV0mimir1
		if err := json.Unmarshal(raw, &receiverEmailV0mimir1); err != nil {
			return err
		}

		resource.EmailV0mimir1 = &receiverEmailV0mimir1
		return nil
	case "email/v1":
		var receiverEmailV1 ReceiverEmailV1
		if err := json.Unmarshal(raw, &receiverEmailV1); err != nil {
			return err
		}

		resource.EmailV1 = &receiverEmailV1
		return nil
	case "googlechat/v1":
		var receiverGooglechatV1 ReceiverGooglechatV1
		if err := json.Unmarshal(raw, &receiverGooglechatV1); err != nil {
			return err
		}

		resource.GooglechatV1 = &receiverGooglechatV1
		return nil
	case "jira/v0mimir1":
		var receiverJiraV0mimir1 ReceiverJiraV0mimir1
		if err := json.Unmarshal(raw, &receiverJiraV0mimir1); err != nil {
			return err
		}

		resource.JiraV0mimir1 = &receiverJiraV0mimir1
		return nil
	case "jira/v1":
		var receiverJiraV1 ReceiverJiraV1
		if err := json.Unmarshal(raw, &receiverJiraV1); err != nil {
			return err
		}

		resource.JiraV1 = &receiverJiraV1
		return nil
	case "kafka/v1":
		var receiverKafkaV1 ReceiverKafkaV1
		if err := json.Unmarshal(raw, &receiverKafkaV1); err != nil {
			return err
		}

		resource.KafkaV1 = &receiverKafkaV1
		return nil
	case "mqtt/v1":
		var receiverMqttV1 ReceiverMqttV1
		if err := json.Unmarshal(raw, &receiverMqttV1); err != nil {
			return err
		}

		resource.MqttV1 = &receiverMqttV1
		return nil
	case "oncall/v1":
		var receiverOncallV1 ReceiverOncallV1
		if err := json.Unmarshal(raw, &receiverOncallV1); err != nil {
			return err
		}

		resource.OncallV1 = &receiverOncallV1
		return nil
	case "opsgenie/v0mimir1":
		var receiverOpsgenieV0mimir1 ReceiverOpsgenieV0mimir1
		if err := json.Unmarshal(raw, &receiverOpsgenieV0mimir1); err != nil {
			return err
		}

		resource.OpsgenieV0mimir1 = &receiverOpsgenieV0mimir1
		return nil
	case "opsgenie/v1":
		var receiverOpsgenieV1 ReceiverOpsgenieV1
		if err := json.Unmarshal(raw, &receiverOpsgenieV1); err != nil {
			return err
		}

		resource.OpsgenieV1 = &receiverOpsgenieV1
		return nil
	case "pagerduty/v0mimir1":
		var receiverPagerdutyV0mimir1 ReceiverPagerdutyV0mimir1
		if err := json.Unmarshal(raw, &receiverPagerdutyV0mimir1); err != nil {
			return err
		}

		resource.PagerdutyV0mimir1 = &receiverPagerdutyV0mimir1
		return nil
	case "pagerduty/v1":
		var receiverPagerdutyV1 ReceiverPagerdutyV1
		if err := json.Unmarshal(raw, &receiverPagerdutyV1); err != nil {
			return err
		}

		resource.PagerdutyV1 = &receiverPagerdutyV1
		return nil
	case "prometheus-alertmanager/v1":
		var receiverPrometheusAlertmanagerV1 ReceiverPrometheusAlertmanagerV1
		if err := json.Unmarshal(raw, &receiverPrometheusAlertmanagerV1); err != nil {
			return err
		}

		resource.PrometheusAlertmanagerV1 = &receiverPrometheusAlertmanagerV1
		return nil
	case "pushover/v0mimir1":
		var receiverPushoverV0mimir1 ReceiverPushoverV0mimir1
		if err := json.Unmarshal(raw, &receiverPushoverV0mimir1); err != nil {
			return err
		}

		resource.PushoverV0mimir1 = &receiverPushoverV0mimir1
		return nil
	case "pushover/v1":
		var receiverPushoverV1 ReceiverPushoverV1
		if err := json.Unmarshal(raw, &receiverPushoverV1); err != nil {
			return err
		}

		resource.PushoverV1 = &receiverPushoverV1
		return nil
	case "sensugo/v1":
		var receiverSensugoV1 ReceiverSensugoV1
		if err := json.Unmarshal(raw, &receiverSensugoV1); err != nil {
			return err
		}

		resource.SensugoV1 = &receiverSensugoV1
		return nil
	case "slack/v0mimir1":
		var receiverSlackV0mimir1 ReceiverSlackV0mimir1
		if err := json.Unmarshal(raw, &receiverSlackV0mimir1); err != nil {
			return err
		}

		resource.SlackV0mimir1 = &receiverSlackV0mimir1
		return nil
	case "slack/v1":
		var receiverSlackV1 ReceiverSlackV1
		if err := json.Unmarshal(raw, &receiverSlackV1); err != nil {
			return err
		}

		resource.SlackV1 = &receiverSlackV1
		return nil
	case "sns/v0mimir1":
		var receiverSnsV0mimir1 ReceiverSnsV0mimir1
		if err := json.Unmarshal(raw, &receiverSnsV0mimir1); err != nil {
			return err
		}

		resource.SnsV0mimir1 = &receiverSnsV0mimir1
		return nil
	case "sns/v1":
		var receiverSnsV1 ReceiverSnsV1
		if err := json.Unmarshal(raw, &receiverSnsV1); err != nil {
			return err
		}

		resource.SnsV1 = &receiverSnsV1
		return nil
	case "teams/v0mimir1":
		var receiverTeamsV0mimir1 ReceiverTeamsV0mimir1
		if err := json.Unmarshal(raw, &receiverTeamsV0mimir1); err != nil {
			return err
		}

		resource.TeamsV0mimir1 = &receiverTeamsV0mimir1
		return nil
	case "teams/v0mimir2":
		var receiverTeamsV0mimir2 ReceiverTeamsV0mimir2
		if err := json.Unmarshal(raw, &receiverTeamsV0mimir2); err != nil {
			return err
		}

		resource.TeamsV0mimir2 = &receiverTeamsV0mimir2
		return nil
	case "teams/v1":
		var receiverTeamsV1 ReceiverTeamsV1
		if err := json.Unmarshal(raw, &receiverTeamsV1); err != nil {
			return err
		}

		resource.TeamsV1 = &receiverTeamsV1
		return nil
	case "telegram/v0mimir1":
		var receiverTelegramV0mimir1 ReceiverTelegramV0mimir1
		if err := json.Unmarshal(raw, &receiverTelegramV0mimir1); err != nil {
			return err
		}

		resource.TelegramV0mimir1 = &receiverTelegramV0mimir1
		return nil
	case "telegram/v1":
		var receiverTelegramV1 ReceiverTelegramV1
		if err := json.Unmarshal(raw, &receiverTelegramV1); err != nil {
			return err
		}

		resource.TelegramV1 = &receiverTelegramV1
		return nil
	case "threema/v1":
		var receiverThreemaV1 ReceiverThreemaV1
		if err := json.Unmarshal(raw, &receiverThreemaV1); err != nil {
			return err
		}

		resource.ThreemaV1 = &receiverThreemaV1
		return nil
	case "victorops/v0mimir1":
		var receiverVictoropsV0mimir1 ReceiverVictoropsV0mimir1
		if err := json.Unmarshal(raw, &receiverVictoropsV0mimir1); err != nil {
			return err
		}

		resource.VictoropsV0mimir1 = &receiverVictoropsV0mimir1
		return nil
	case "victorops/v1":
		var receiverVictoropsV1 ReceiverVictoropsV1
		if err := json.Unmarshal(raw, &receiverVictoropsV1); err != nil {
			return err
		}

		resource.VictoropsV1 = &receiverVictoropsV1
		return nil
	case "webex/v0mimir1":
		var receiverWebexV0mimir1 ReceiverWebexV0mimir1
		if err := json.Unmarshal(raw, &receiverWebexV0mimir1); err != nil {
			return err
		}

		resource.WebexV0mimir1 = &receiverWebexV0mimir1
		return nil
	case "webex/v1":
		var receiverWebexV1 ReceiverWebexV1
		if err := json.Unmarshal(raw, &receiverWebexV1); err != nil {
			return err
		}

		resource.WebexV1 = &receiverWebexV1
		return nil
	case "webhook/v0mimir1":
		var receiverWebhookV0mimir1 ReceiverWebhookV0mimir1
		if err := json.Unmarshal(raw, &receiverWebhookV0mimir1); err != nil {
			return err
		}

		resource.WebhookV0mimir1 = &receiverWebhookV0mimir1
		return nil
	case "webhook/v1":
		var receiverWebhookV1 ReceiverWebhookV1
		if err := json.Unmarshal(raw, &receiverWebhookV1); err != nil {
			return err
		}

		resource.WebhookV1 = &receiverWebhookV1
		return nil
	case "wechat/v0mimir1":
		var receiverWechatV0mimir1 ReceiverWechatV0mimir1
		if err := json.Unmarshal(raw, &receiverWechatV0mimir1); err != nil {
			return err
		}

		resource.WechatV0mimir1 = &receiverWechatV0mimir1
		return nil
	case "wecom/v1":
		var receiverWecomV1 ReceiverWecomV1
		if err := json.Unmarshal(raw, &receiverWecomV1); err != nil {
			return err
		}

		resource.WecomV1 = &receiverWecomV1
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1.
func (ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverDingdingV1OrDiscordV0mimir1OrDiscordV1OrEmailV0mimir1OrEmailV1OrGooglechatV1OrJiraV0mimir1OrJiraV1OrKafkaV1OrLINEV1OrMqttV1OrOncallV1OrOpsgenieV0mimir1OrOpsgenieV1OrPagerdutyV0mimir1OrPagerdutyV1OrPrometheusAlertmanagerV1OrPushoverV0mimir1OrPushoverV1OrSensugoV1OrSlackV0mimir1OrSlackV1OrSnsV0mimir1OrSnsV1OrTeamsV0mimir1OrTeamsV0mimir2OrTeamsV1OrTelegramV0mimir1OrTelegramV1OrThreemaV1OrVictoropsV0mimir1OrVictoropsV1OrWebexV0mimir1OrWebexV1OrWebhookV0mimir1OrWebhookV1OrWechatV0mimir1OrWecomV1"
}
