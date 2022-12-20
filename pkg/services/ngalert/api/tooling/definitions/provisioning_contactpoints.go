package definitions

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
)

// swagger:route GET /api/v1/provisioning/contact-points provisioning stable RouteGetContactpoints
//
// Get all the contact points.
//
//     Responses:
//       200: ContactPoints

// swagger:route POST /api/v1/provisioning/contact-points provisioning stable RoutePostContactpoints
//
// Create a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: EmbeddedContactPoint
//       400: ValidationError

// swagger:route PUT /api/v1/provisioning/contact-points/{UID} provisioning stable RoutePutContactpoint
//
// Update an existing contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/contact-points/{UID} provisioning stable RouteDeleteContactpoints
//
// Delete a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       204: description: The contact point was deleted successfully.

// swagger:parameters RoutePutContactpoint RouteDeleteContactpoints
type ContactPointUIDReference struct {
	// UID is the contact point unique identifier
	// in:path
	UID string
}

// swagger:parameters RoutePostContactpoints RoutePutContactpoint
type ContactPointPayload struct {
	// in:body
	Body EmbeddedContactPoint
}

// swagger:model
type ContactPoints []EmbeddedContactPoint

// EmbeddedContactPoint is the contact point type that is used
// by grafanas embedded alertmanager implementation.
// swagger:model
type EmbeddedContactPoint struct {
	// UID is the unique identifier of the contact point. The UID can be
	// set by the user.
	// example: my_external_reference
	UID string `json:"uid"`
	// Name is used as grouping key in the UI. Contact points with the
	// same name will be grouped in the UI.
	// example: webhook_1
	Name string `json:"name" binding:"required"`
	// required: true
	// example: webhook
	// enum: alertmanager, dingding, discord, email, googlechat, kafka, line, opsgenie, pagerduty, pushover, sensugo, slack, teams, telegram, threema, victorops, webhook, wecom
	Type string `json:"type" binding:"required"`
	// required: true
	Settings *simplejson.Json `json:"settings" binding:"required"`
	// example: false
	DisableResolveMessage bool `json:"disableResolveMessage"`
	// readonly: true
	Provenance string `json:"provenance,omitempty"`
}

const RedactedValue = "[REDACTED]"

func (e *EmbeddedContactPoint) Valid(decryptFunc channels.GetDecryptedValueFn) error {
	if e.Type == "" {
		return fmt.Errorf("type should not be an empty string")
	}
	if e.Settings == nil {
		return fmt.Errorf("settings should not be empty")
	}
	factory, exists := channels.Factory(e.Type)
	if !exists {
		return fmt.Errorf("unknown type '%s'", e.Type)
	}
	cfg, _ := channels.NewFactoryConfig(&channels.NotificationChannelConfig{
		Settings: e.Settings,
		Type:     e.Type,
	}, nil, decryptFunc, nil)
	if _, err := factory(cfg); err != nil {
		return err
	}
	return nil
}

func (e *EmbeddedContactPoint) SecretKeys() ([]string, error) {
	switch e.Type {
	case "alertmanager":
		return []string{"basicAuthPassword"}, nil
	case "dingding":
		return []string{}, nil
	case "discord":
		return []string{}, nil
	case "email":
		return []string{}, nil
	case "googlechat":
		return []string{}, nil
	case "kafka":
		return []string{}, nil
	case "line":
		return []string{"token"}, nil
	case "opsgenie":
		return []string{"apiKey"}, nil
	case "pagerduty":
		return []string{"integrationKey"}, nil
	case "pushover":
		return []string{"userKey", "apiToken"}, nil
	case "sensugo":
		return []string{"apiKey"}, nil
	case "slack":
		return []string{"url", "token"}, nil
	case "teams":
		return []string{}, nil
	case "telegram":
		return []string{"bottoken"}, nil
	case "threema":
		return []string{"api_secret"}, nil
	case "victorops":
		return []string{}, nil
	case "webhook":
		return []string{}, nil
	case "wecom":
		return []string{"url"}, nil
	// LOGZ.IO GRAFANA CHANGE :: DEV-35483 - Add type to support logzio opsgenie integration
	case "logzio_opsgenie":
		return []string{"apiKey"}, nil
	}
	// LOGZ.IO GRAFANA CHANGE :: end
	return nil, fmt.Errorf("no secrets configured for type '%s'", e.Type)
}

func (e *EmbeddedContactPoint) ExtractSecrets() (map[string]string, error) {
	secrets := map[string]string{}
	secretKeys, err := e.SecretKeys()
	if err != nil {
		return nil, err
	}
	for _, secretKey := range secretKeys {
		secretValue := e.Settings.Get(secretKey).MustString()
		e.Settings.Del(secretKey)
		secrets[secretKey] = secretValue
	}
	return secrets, nil
}

func (e *EmbeddedContactPoint) ResourceID() string {
	return e.UID
}

func (e *EmbeddedContactPoint) ResourceType() string {
	return "contactPoint"
}
