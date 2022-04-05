package models

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// EmbeddedContactPoint is the contact point type that is used
// by grafanas embedded alertmanager implementation.
type EmbeddedContactPoint struct {
	UID                   string           `json:"uid"`
	Name                  string           `json:"name"`
	Type                  string           `json:"type"`
	DisableResolveMessage bool             `json:"disableResolveMessage"`
	Settings              *simplejson.Json `json:"settings"`
	Provenance            string           `json:"provanance"`
}

const RedactedValue = "[REDACTED]"

func (e *EmbeddedContactPoint) IsValid() bool {
	if e.Type == "" {
		return false
	}
	if e.Settings == nil {
		return false
	}
	return true
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

func (e *EmbeddedContactPoint) ExtractSecrtes() (map[string]string, error) {
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
