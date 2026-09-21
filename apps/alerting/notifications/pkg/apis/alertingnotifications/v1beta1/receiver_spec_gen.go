// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type ReceiverIntegration = ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1

// NewReceiverIntegration creates a new ReceiverIntegration object.
func NewReceiverIntegration() *ReceiverIntegration {
	return NewReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1()
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
type ReceiverEmailMimir1 struct {
	Uid                   *string                            `json:"uid,omitempty"`
	DisableResolveMessage *bool                              `json:"disableResolveMessage,omitempty"`
	Type                  string                             `json:"type"`
	Version               string                             `json:"version"`
	Settings              ReceiverV1beta1EmailMimir1Settings `json:"settings"`
	Variant               *string                            `json:"variant,omitempty"`
}

// NewReceiverEmailMimir1 creates a new ReceiverEmailMimir1 object.
func NewReceiverEmailMimir1() *ReceiverEmailMimir1 {
	return &ReceiverEmailMimir1{
		Type:     "email",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1EmailMimir1Settings(),
		Variant:  (func(input string) *string { return &input })("email/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverEmailMimir1.
func (ReceiverEmailMimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverEmailMimir1"
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
type ReceiverSlackMimir1 struct {
	Uid                   *string                            `json:"uid,omitempty"`
	DisableResolveMessage *bool                              `json:"disableResolveMessage,omitempty"`
	Type                  string                             `json:"type"`
	Version               string                             `json:"version"`
	Settings              ReceiverV1beta1SlackMimir1Settings `json:"settings"`
	Variant               *string                            `json:"variant,omitempty"`
}

// NewReceiverSlackMimir1 creates a new ReceiverSlackMimir1 object.
func NewReceiverSlackMimir1() *ReceiverSlackMimir1 {
	return &ReceiverSlackMimir1{
		Type:     "slack",
		Version:  "v0mimir1",
		Settings: *NewReceiverV1beta1SlackMimir1Settings(),
		Variant:  (func(input string) *string { return &input })("slack/v0mimir1"),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverSlackMimir1.
func (ReceiverSlackMimir1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverSlackMimir1"
}

// +k8s:openapi-gen=true
type ReceiverWebhookV1 struct {
	Uid                   *string                          `json:"uid,omitempty"`
	DisableResolveMessage *bool                            `json:"disableResolveMessage,omitempty"`
	Type                  string                           `json:"type"`
	Version               string                           `json:"version"`
	Settings              ReceiverV1beta1WebhookV1Settings `json:"settings"`
	SecureFields          map[string]bool                  `json:"secureFields,omitempty"`
	Variant               *string                          `json:"variant,omitempty"`
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
type ReceiverV1beta1EmailV1Settings struct {
	Addresses   string  `json:"addresses"`
	SingleEmail *bool   `json:"singleEmail,omitempty"`
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
type ReceiverV1beta1EmailMimir1Settings struct {
	To        *string `json:"to,omitempty"`
	From      *string `json:"from,omitempty"`
	Smarthost *string `json:"smarthost,omitempty"`
	Html      *string `json:"html,omitempty"`
}

// NewReceiverV1beta1EmailMimir1Settings creates a new ReceiverV1beta1EmailMimir1Settings object.
func NewReceiverV1beta1EmailMimir1Settings() *ReceiverV1beta1EmailMimir1Settings {
	return &ReceiverV1beta1EmailMimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1EmailMimir1Settings.
func (ReceiverV1beta1EmailMimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1EmailMimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1SlackV1Settings struct {
	EndpointUrl    *string `json:"endpointUrl,omitempty"`
	Recipient      *string `json:"recipient,omitempty"`
	Text           *string `json:"text,omitempty"`
	Title          *string `json:"title,omitempty"`
	Username       *string `json:"username,omitempty"`
	MentionChannel *string `json:"mentionChannel,omitempty"`
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
type ReceiverV1beta1SlackMimir1Settings struct {
	Channel  *string `json:"channel,omitempty"`
	Color    *string `json:"color,omitempty"`
	Fallback *string `json:"fallback,omitempty"`
}

// NewReceiverV1beta1SlackMimir1Settings creates a new ReceiverV1beta1SlackMimir1Settings object.
func NewReceiverV1beta1SlackMimir1Settings() *ReceiverV1beta1SlackMimir1Settings {
	return &ReceiverV1beta1SlackMimir1Settings{}
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverV1beta1SlackMimir1Settings.
func (ReceiverV1beta1SlackMimir1Settings) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverV1beta1SlackMimir1Settings"
}

// +k8s:openapi-gen=true
type ReceiverV1beta1WebhookV1Settings struct {
	Url        string  `json:"url"`
	HttpMethod *string `json:"httpMethod,omitempty"`
	MaxAlerts  *int64  `json:"maxAlerts,omitempty"`
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
type ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1 struct {
	EmailV1     *ReceiverEmailV1     `json:"EmailV1,omitempty"`
	EmailMimir1 *ReceiverEmailMimir1 `json:"EmailMimir1,omitempty"`
	SlackV1     *ReceiverSlackV1     `json:"SlackV1,omitempty"`
	SlackMimir1 *ReceiverSlackMimir1 `json:"SlackMimir1,omitempty"`
	WebhookV1   *ReceiverWebhookV1   `json:"WebhookV1,omitempty"`
}

// NewReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1 creates a new ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1 object.
func NewReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1() *ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1 {
	return &ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1` as JSON.
func (resource ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1) MarshalJSON() ([]byte, error) {
	if resource.EmailV1 != nil {
		return json.Marshal(resource.EmailV1)
	}
	if resource.EmailMimir1 != nil {
		return json.Marshal(resource.EmailMimir1)
	}
	if resource.SlackV1 != nil {
		return json.Marshal(resource.SlackV1)
	}
	if resource.SlackMimir1 != nil {
		return json.Marshal(resource.SlackMimir1)
	}
	if resource.WebhookV1 != nil {
		return json.Marshal(resource.WebhookV1)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1` from JSON.
func (resource *ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1) UnmarshalJSON(raw []byte) error {
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
	case "email/v0mimir1":
		var receiverEmailMimir1 ReceiverEmailMimir1
		if err := json.Unmarshal(raw, &receiverEmailMimir1); err != nil {
			return err
		}

		resource.EmailMimir1 = &receiverEmailMimir1
		return nil
	case "email/v1":
		var receiverEmailV1 ReceiverEmailV1
		if err := json.Unmarshal(raw, &receiverEmailV1); err != nil {
			return err
		}

		resource.EmailV1 = &receiverEmailV1
		return nil
	case "slack/v0mimir1":
		var receiverSlackMimir1 ReceiverSlackMimir1
		if err := json.Unmarshal(raw, &receiverSlackMimir1); err != nil {
			return err
		}

		resource.SlackMimir1 = &receiverSlackMimir1
		return nil
	case "slack/v1":
		var receiverSlackV1 ReceiverSlackV1
		if err := json.Unmarshal(raw, &receiverSlackV1); err != nil {
			return err
		}

		resource.SlackV1 = &receiverSlackV1
		return nil
	case "webhook/v1":
		var receiverWebhookV1 ReceiverWebhookV1
		if err := json.Unmarshal(raw, &receiverWebhookV1); err != nil {
			return err
		}

		resource.WebhookV1 = &receiverWebhookV1
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1.
func (ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ReceiverEmailV1OrEmailMimir1OrSlackV1OrSlackMimir1OrWebhookV1"
}
