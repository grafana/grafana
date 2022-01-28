package services

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

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
	//  Removing the secureSettings from the JSON object as this can
	//  be a confusing implementation detail to the user. Settings that
	//  should be encrpted will still be encrypted but injected back to the
	//  main settings
	//	SecureSettings        map[string]string `json:"secureSettings"`
	Provenance string `json:"provanance"`
}

var (
	ErrContactPointNoTypeSet           = errors.New("contact point 'type' field should not be empty")
	ErrContactPointNoSettingsSet       = errors.New("contact point 'settings' field should not be empty")
	ErrContactPointSettingsNotReadable = errors.New("contact point 'settings' not readable")
)

func (e *EmbeddedContactPoint) IsValid() (bool, error) {
	fmt.Printf("%+v\n", *e)
	if e.Type == "" {
		return false, ErrContactPointNoTypeSet
	}
	if e.Settings == nil {
		return false, ErrContactPointNoSettingsSet
	}
	return e.hasValidSettings()
}

func (e *EmbeddedContactPoint) hasValidSettings() (bool, error) {
	switch strings.ToLower(e.Type) {
	//TODO(JP): add all validators
	case "slack":
		mentionChannel := e.Settings.Get("mentionChannel").MustString()
		if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
			return false, fmt.Errorf("invalid value for mentionChannel: %q", mentionChannel)
		}
		return true, nil
	case "kafka":
		endpoint := e.Settings.Get("kafkaRestProxy").MustString()
		if endpoint == "" {
			return false, errors.New("could not find kafka rest proxy endpoint property in settings")
		}
		topic := e.Settings.Get("kafkaTopic").MustString()
		if topic == "" {
			return false, errors.New("could not find kafka topic property in settings")
		}
		return true, nil
	case "pagerduty":
		return true, nil
	default:
		return false, fmt.Errorf("contact point has an unknown type '%s'", e.Type)
	}
}

func (e *EmbeddedContactPoint) extractSecrtes() (map[string]string, error) {
	switch strings.ToLower(e.Type) {
	case "pagerduty":
		integrationKey := e.Settings.Get("integrationKey").MustString("")
		if integrationKey != "" || integrationKey == "[REDACTED]" {
			e.Settings.Del("integrationKey")
			return map[string]string{"integrationKey": integrationKey}, nil
		}
		return map[string]string{}, nil
	}
	return map[string]string{}, nil
}

type ContactPointService interface {
	GetContactPoints(orgID int64) ([]EmbeddedContactPoint, error)
	CreateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) (EmbeddedContactPoint, error)
	UpdateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) (EmbeddedContactPoint, error)
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
			fmt.Printf("decrypted value: %s %s\n", k, decryptedValue)
			embeddedContactPoint.Settings.Set(k, "[REDACTED]")
		}
		contactPoints = append(contactPoints, embeddedContactPoint)
	}
	return contactPoints, nil
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

func (ecp *EmbeddedContactPointService) UpdateContactPoint(orgID int64, contactPoint EmbeddedContactPoint) (EmbeddedContactPoint, error) {
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
		if v == "[REDACTED]" {
			delete(extracedSecrets, k)
			continue
		}
		encryptedValue, err := ecp.encryptValue(v)
		if err != nil {
			return EmbeddedContactPoint{}, err
		}
		extracedSecrets[k] = encryptedValue
	}
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
			for i, cp := range receiver.GrafanaManagedReceivers {
				if cp.UID == contactPoint.UID {
					for k, v := range cp.SecureSettings {
						if _, exists := extracedSecrets[k]; exists {
							continue
						}
						extracedSecrets[k] = v
					}
					grafanaReceiver.SecureSettings = extracedSecrets
					receiver.GrafanaManagedReceivers[i] = grafanaReceiver
					receiverFound = true
					break
				}
			}
			break
		}
	}
	if !receiverFound {
		return EmbeddedContactPoint{}, fmt.Errorf("contact point with name '%s' and uid '%s' not found", grafanaReceiver.Name, grafanaReceiver.UID)
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
