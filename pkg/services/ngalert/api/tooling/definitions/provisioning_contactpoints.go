package definitions

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
)

// swagger:route GET /api/provisioning/contact-points provisioning RouteGetContactpoints
//
// Get all the contact points.
//
//     Responses:
//       200: Route
//       400: ValidationError

// swagger:route POST /api/provisioning/contact-points provisioning RoutePostContactpoints
//
// Create a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route PUT /api/provisioning/contact-points/{ID} provisioning RoutePutContactpoint
//
// Update an existing contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:route DELETE /api/provisioning/contact-points/{ID} provisioning RouteDeleteContactpoints
//
// Delete a contact point.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Accepted
//       400: ValidationError

// swagger:parameters RoutePostContactpoints RoutePutContactpoint
type ContactPointPayload struct {
	// in:body
	Body EmbeddedContactPoint
}

// EmbeddedContactPoint is the contact point type that is used
// by grafanas embedded alertmanager implementation.
type EmbeddedContactPoint struct {
	// UID is the unique identifier of the contact point. This will be
	// automatically set be the Grafana.
	UID string `json:"uid"`
	// Name is used as grouping key in the UI. Contact points with the
	// same name will be grouped in the UI.
	Name                  string           `json:"name" binding:"required"`
	Type                  string           `json:"type" binding:"required"`
	Settings              *simplejson.Json `json:"settings" binding:"required"`
	DisableResolveMessage bool             `json:"disableResolveMessage"`
	Provenance            string           `json:"provenance"`
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
	}, nil, decryptFunc, nil, nil)
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
	}
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
