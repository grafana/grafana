package services

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/common"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/alertmanager/config"
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

var (
	ErrContactPointNoTypeSet           = errors.New("contact point 'type' field should not be empty")
	ErrContactPointNoSettingsSet       = errors.New("contact point 'settings' field should not be empty")
	ErrContactPointSettingsNotReadable = errors.New("contact point 'settings' not readable")
)

func (e *EmbeddedContactPoint) IsValid() (bool, error) {
	return validateContactPointReceiver(e)
}

func (e *EmbeddedContactPoint) secretKeys() ([]string, error) {
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

func (e *EmbeddedContactPoint) extractSecrtes() (map[string]string, error) {
	secrets := map[string]string{}
	secretKeys, err := e.secretKeys()
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

type ContactPointService interface {
	GetContactPoints(orgID int64) ([]EmbeddedContactPoint, error)
	CreateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) (EmbeddedContactPoint, error)
	UpdateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) error
	DeleteContactPoint(orgID int64, uid string) error
}

type EmbeddedContactPointService struct {
	amStore           AMStore
	encryptionService secrets.Service
}

func NewEmbeddedContactPointService(store AMStore, encryptionService secrets.Service) *EmbeddedContactPointService {
	return &EmbeddedContactPointService{
		amStore:           store,
		encryptionService: encryptionService,
	}
}

func (ecp *EmbeddedContactPointService) GetContactPoints(orgID int64) ([]EmbeddedContactPoint, error) {
	cfg, _, err := ecp.getCurrentConfig(orgID)
	if err != nil {
		return nil, err
	}
	contactPoints := []EmbeddedContactPoint{}
	for _, contactPoint := range cfg.GetGrafanaReceiverMap() {
		embeddedContactPoint := EmbeddedContactPoint{
			UID:                   contactPoint.UID,
			Type:                  contactPoint.Type,
			Name:                  contactPoint.Name,
			DisableResolveMessage: contactPoint.DisableResolveMessage,
			Settings:              contactPoint.Settings,
		}
		for k, v := range contactPoint.SecureSettings {
			decryptedValue, err := ecp.decrypteValue(v)
			if err != nil {
				// TODO(JP): log a warning
				continue
			}
			if decryptedValue == "" {
				continue
			}
			embeddedContactPoint.Settings.Set(k, RedactedValue)
		}
		contactPoints = append(contactPoints, embeddedContactPoint)
	}
	return contactPoints, nil
}

// internal only
func (ecp *EmbeddedContactPointService) getContactPointUncrypted(orgID int64, uid string) (EmbeddedContactPoint, error) {
	cfg, _, err := ecp.getCurrentConfig(orgID)
	if err != nil {
		return EmbeddedContactPoint{}, err
	}
	for _, receiver := range cfg.GetGrafanaReceiverMap() {
		if receiver.UID != uid {
			continue
		}
		embeddedContactPoint := EmbeddedContactPoint{
			UID:                   receiver.UID,
			Type:                  receiver.Type,
			Name:                  receiver.Name,
			DisableResolveMessage: receiver.DisableResolveMessage,
			Settings:              receiver.Settings,
		}
		for k, v := range receiver.SecureSettings {
			decryptedValue, err := ecp.decrypteValue(v)
			if err != nil {
				// TODO(JP): log a warning
				continue
			}
			if decryptedValue == "" {
				continue
			}
			embeddedContactPoint.Settings.Set(k, decryptedValue)

		}
		return embeddedContactPoint, nil
	}
	return EmbeddedContactPoint{}, fmt.Errorf("contact point with uid '%s' not found", uid)
}

func (ecp *EmbeddedContactPointService) CreateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) (EmbeddedContactPoint, error) {
	if isValid, err := contactPoint.IsValid(); !isValid {
		return EmbeddedContactPoint{}, fmt.Errorf("contact point is not valid: %w", err)
	}
	cfg, fetchedHash, err := ecp.getCurrentConfig(orgID)
	if err != nil {
		return EmbeddedContactPoint{}, err
	}
	extracedSecrets, err := contactPoint.extractSecrtes()
	if err != nil {
		return EmbeddedContactPoint{}, err
	}
	for k, v := range extracedSecrets {
		encryptedValue, err := ecp.encryptValue(v)
		if err != nil {
			return EmbeddedContactPoint{}, err
		}
		extracedSecrets[k] = encryptedValue
	}
	contactPoint.UID = util.GenerateShortUID()
	grafanaReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              contactPoint.Settings,
		SecureSettings:        extracedSecrets,
	}
	receiverFound := false
	for _, receiver := range cfg.AlertmanagerConfig.Receivers {
		if receiver.Name == contactPoint.Name {
			receiver.PostableGrafanaReceivers.GrafanaManagedReceivers = append(receiver.PostableGrafanaReceivers.GrafanaManagedReceivers, grafanaReceiver)
			receiverFound = true
		}
	}
	if !receiverFound {
		cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, &apimodels.PostableApiReceiver{
			Receiver: config.Receiver{
				Name: grafanaReceiver.Name,
			},
			PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{grafanaReceiver},
			},
		})
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return EmbeddedContactPoint{}, err
	}
	return contactPoint, ecp.amStore.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         orgID,
		FetchedHash:                   fetchedHash,
	})
}

func (ecp *EmbeddedContactPointService) UpdateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) error {
	// set all redacted values with the latest known value from the store
	rawContactPoint, err := ecp.getContactPointUncrypted(orgID, contactPoint.UID)
	if err != nil {
		return err
	}
	secretKeys, err := contactPoint.secretKeys()
	if err != nil {
		return err
	}
	for _, secretKey := range secretKeys {
		secretValue := contactPoint.Settings.Get(secretKey).MustString()
		if secretValue == RedactedValue {
			contactPoint.Settings.Set(secretKey, rawContactPoint.Settings.Get(secretKey).MustString())
		}
	}
	// validate merged values
	if isValid, err := contactPoint.IsValid(); !isValid {
		return fmt.Errorf("contact point is not valid: %w", err)
	}
	fmt.Printf("%+v\n", *contactPoint.Settings)
	// transform to internal model
	extracedSecrets, err := contactPoint.extractSecrtes()
	if err != nil {
		return err
	}
	for k, v := range extracedSecrets {
		encryptedValue, err := ecp.encryptValue(v)
		if err != nil {
			return err
		}
		extracedSecrets[k] = encryptedValue
	}
	mergedReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              contactPoint.Settings,
		SecureSettings:        extracedSecrets,
	}
	// save to store
	cfg, fetchedHash, err := ecp.getCurrentConfig(orgID)
	if err != nil {
		return err
	}
	for _, receiver := range cfg.AlertmanagerConfig.Receivers {
		if receiver.Name == contactPoint.Name {
			receiverNotFound := true
			for i, grafanaReceiver := range receiver.GrafanaManagedReceivers {
				if grafanaReceiver.UID == mergedReceiver.UID {
					receiverNotFound = false
					receiver.GrafanaManagedReceivers[i] = mergedReceiver
					break
				}
			}
			if receiverNotFound {
				return fmt.Errorf("contact point with uid '%s' not found", mergedReceiver.UID)
			}
		}
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return ecp.amStore.UpdateAlertManagerConfiguration(&models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration:     string(data),
		AlertmanagerConfigurationHash: fmt.Sprintf("%x", md5.Sum(data)),
		ConfigurationVersion:          "v1",
		Default:                       false,
		OrgID:                         orgID,
		FetchedHash:                   fetchedHash,
	})
}

func (ecp *EmbeddedContactPointService) DeleteContactPoint(orgID int64, uid string) error {
	return nil
}

func (ecp *EmbeddedContactPointService) getCurrentConfig(orgID int64) (*apimodels.PostableUserConfig, string, error) {
	query := &models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := ecp.amStore.GetLatestAlertmanagerConfiguration(query)
	if err != nil {
		return nil, "", err
	}
	cfg, err := common.LoadAMConfig([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, "", err
	}
	return cfg, query.Result.AlertmanagerConfigurationHash, nil
}

func (ecp *EmbeddedContactPointService) decrypteValue(value string) (string, error) {
	decodeValue, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}

	decryptedValue, err := ecp.encryptionService.Decrypt(context.Background(), decodeValue)
	if err != nil {
		return "", err
	}

	return string(decryptedValue), nil
}

func (ecp *EmbeddedContactPointService) encryptValue(value string) (string, error) {
	encryptedData, err := ecp.encryptionService.Encrypt(context.Background(), []byte(value), secrets.WithoutScope())
	if err != nil {
		return "", fmt.Errorf("failed to encrypt secure settings: %w", err)
	}
	return base64.StdEncoding.EncodeToString(encryptedData), nil
}
