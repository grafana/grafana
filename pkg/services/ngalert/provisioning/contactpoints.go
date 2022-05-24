package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/alertmanager/config"
)

type ContactPointService struct {
	amStore           AMConfigStore
	encryptionService secrets.Service
	provenanceStore   ProvisioningStore
	xact              TransactionManager
	log               log.Logger
}

func NewContactPointService(store store.AlertingStore, encryptionService secrets.Service,
	provenanceStore ProvisioningStore, xact TransactionManager, log log.Logger) *ContactPointService {
	return &ContactPointService{
		amStore:           store,
		encryptionService: encryptionService,
		provenanceStore:   provenanceStore,
		xact:              xact,
		log:               log,
	}
}

func (ecp *ContactPointService) GetContactPoints(ctx context.Context, orgID int64) ([]apimodels.EmbeddedContactPoint, error) {
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return nil, err
	}
	provenances, err := ecp.provenanceStore.GetProvenances(ctx, orgID, "contactPoint")
	if err != nil {
		return nil, err
	}
	contactPoints := []apimodels.EmbeddedContactPoint{}
	for _, contactPoint := range revision.cfg.GetGrafanaReceiverMap() {
		embeddedContactPoint := apimodels.EmbeddedContactPoint{
			UID:                   contactPoint.UID,
			Type:                  contactPoint.Type,
			Name:                  contactPoint.Name,
			DisableResolveMessage: contactPoint.DisableResolveMessage,
			Settings:              contactPoint.Settings,
		}
		if val, exists := provenances[embeddedContactPoint.UID]; exists && val != "" {
			embeddedContactPoint.Provenance = string(val)
		}
		for k, v := range contactPoint.SecureSettings {
			decryptedValue, err := ecp.decryptValue(v)
			if err != nil {
				ecp.log.Warn("decrypting value failed", "err", err.Error())
				continue
			}
			if decryptedValue == "" {
				continue
			}
			embeddedContactPoint.Settings.Set(k, apimodels.RedactedValue)
		}
		contactPoints = append(contactPoints, embeddedContactPoint)
	}
	sort.SliceStable(contactPoints, func(i, j int) bool {
		return contactPoints[i].Name < contactPoints[j].Name
	})
	return contactPoints, nil
}

// internal only
func (ecp *ContactPointService) getContactPointDecrypted(ctx context.Context, orgID int64, uid string) (apimodels.EmbeddedContactPoint, error) {
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}
	for _, receiver := range revision.cfg.GetGrafanaReceiverMap() {
		if receiver.UID != uid {
			continue
		}
		embeddedContactPoint := apimodels.EmbeddedContactPoint{
			UID:                   receiver.UID,
			Type:                  receiver.Type,
			Name:                  receiver.Name,
			DisableResolveMessage: receiver.DisableResolveMessage,
			Settings:              receiver.Settings,
		}
		for k, v := range receiver.SecureSettings {
			decryptedValue, err := ecp.decryptValue(v)
			if err != nil {
				ecp.log.Warn("decrypting value failed", "err", err.Error())
				continue
			}
			if decryptedValue == "" {
				continue
			}
			embeddedContactPoint.Settings.Set(k, decryptedValue)
		}
		return embeddedContactPoint, nil
	}
	return apimodels.EmbeddedContactPoint{}, fmt.Errorf("contact point with uid '%s' not found", uid)
}

func (ecp *ContactPointService) CreateContactPoint(ctx context.Context, orgID int64,
	contactPoint apimodels.EmbeddedContactPoint, provenance models.Provenance) (apimodels.EmbeddedContactPoint, error) {
	if err := contactPoint.Valid(ecp.encryptionService.GetDecryptedValue); err != nil {
		return apimodels.EmbeddedContactPoint{}, fmt.Errorf("contact point is not valid: %w", err)
	}

	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}

	extractedSecrets, err := contactPoint.ExtractSecrets()
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}

	for k, v := range extractedSecrets {
		encryptedValue, err := ecp.encryptValue(v)
		if err != nil {
			return apimodels.EmbeddedContactPoint{}, err
		}
		extractedSecrets[k] = encryptedValue
	}

	contactPoint.UID = util.GenerateShortUID()
	grafanaReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              contactPoint.Settings,
		SecureSettings:        extractedSecrets,
	}

	receiverFound := false
	for _, receiver := range revision.cfg.AlertmanagerConfig.Receivers {
		if receiver.Name == contactPoint.Name {
			receiver.PostableGrafanaReceivers.GrafanaManagedReceivers = append(receiver.PostableGrafanaReceivers.GrafanaManagedReceivers, grafanaReceiver)
			receiverFound = true
		}
	}

	if !receiverFound {
		revision.cfg.AlertmanagerConfig.Receivers = append(revision.cfg.AlertmanagerConfig.Receivers, &apimodels.PostableApiReceiver{
			Receiver: config.Receiver{
				Name: grafanaReceiver.Name,
			},
			PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{grafanaReceiver},
			},
		})
	}

	data, err := json.Marshal(revision.cfg)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}

	err = ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = ecp.amStore.UpdateAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(data),
			FetchedConfigurationHash:  revision.concurrencyToken,
			ConfigurationVersion:      revision.version,
			Default:                   false,
			OrgID:                     orgID,
		})
		if err != nil {
			return err
		}
		err = ecp.provenanceStore.SetProvenance(ctx, &contactPoint, orgID, provenance)
		if err != nil {
			return err
		}
		contactPoint.Provenance = string(provenance)
		return nil
	})
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}
	for k := range extractedSecrets {
		contactPoint.Settings.Set(k, apimodels.RedactedValue)
	}
	return contactPoint, nil
}

func (ecp *ContactPointService) UpdateContactPoint(ctx context.Context, orgID int64, contactPoint apimodels.EmbeddedContactPoint, provenance models.Provenance) error {
	// set all redacted values with the latest known value from the store
	rawContactPoint, err := ecp.getContactPointDecrypted(ctx, orgID, contactPoint.UID)
	if err != nil {
		return err
	}
	secretKeys, err := contactPoint.SecretKeys()
	if err != nil {
		return err
	}
	for _, secretKey := range secretKeys {
		secretValue := contactPoint.Settings.Get(secretKey).MustString()
		if secretValue == apimodels.RedactedValue {
			contactPoint.Settings.Set(secretKey, rawContactPoint.Settings.Get(secretKey).MustString())
		}
	}
	// validate merged values
	if err := contactPoint.Valid(ecp.encryptionService.GetDecryptedValue); err != nil {
		return err
	}
	// check that provenance is not changed in a invalid way
	storedProvenance, err := ecp.provenanceStore.GetProvenance(ctx, &contactPoint, orgID)
	if err != nil {
		return err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return fmt.Errorf("cannot changed provenance from '%s' to '%s'", storedProvenance, provenance)
	}
	// transform to internal model
	extractedSecrets, err := contactPoint.ExtractSecrets()
	if err != nil {
		return err
	}
	for k, v := range extractedSecrets {
		encryptedValue, err := ecp.encryptValue(v)
		if err != nil {
			return err
		}
		extractedSecrets[k] = encryptedValue
	}
	mergedReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              contactPoint.Settings,
		SecureSettings:        extractedSecrets,
	}
	// save to store
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return err
	}
	for _, receiver := range revision.cfg.AlertmanagerConfig.Receivers {
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
	data, err := json.Marshal(revision.cfg)
	if err != nil {
		return err
	}
	return ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = ecp.amStore.UpdateAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(data),
			FetchedConfigurationHash:  revision.concurrencyToken,
			ConfigurationVersion:      revision.version,
			Default:                   false,
			OrgID:                     orgID,
		})
		if err != nil {
			return err
		}
		err = ecp.provenanceStore.SetProvenance(ctx, &contactPoint, orgID, provenance)
		if err != nil {
			return err
		}
		contactPoint.Provenance = string(provenance)
		return nil
	})
}

func (ecp *ContactPointService) DeleteContactPoint(ctx context.Context, orgID int64, uid string) error {
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return err
	}
	// Indicates if the full contact point is removed or just one of the
	// configurations, as a contactpoint can consist of any number of
	// configurations.
	fullRemoval := false
	// Name of the contact point that will be removed, might be used if a
	// full removal is done to check if it's referenced in any route.
	name := ""
	for i, receiver := range revision.cfg.AlertmanagerConfig.Receivers {
		for j, grafanaReceiver := range receiver.GrafanaManagedReceivers {
			if grafanaReceiver.UID == uid {
				name = grafanaReceiver.Name
				receiver.GrafanaManagedReceivers = append(receiver.GrafanaManagedReceivers[:j], receiver.GrafanaManagedReceivers[j+1:]...)
				// if this was the last receiver we removed, we remove the whole receiver
				if len(receiver.GrafanaManagedReceivers) == 0 {
					fullRemoval = true
					revision.cfg.AlertmanagerConfig.Receivers = append(revision.cfg.AlertmanagerConfig.Receivers[:i], revision.cfg.AlertmanagerConfig.Receivers[i+1:]...)
				}
				break
			}
		}
	}
	if fullRemoval && isContactPointInUse(name, []*apimodels.Route{revision.cfg.AlertmanagerConfig.Route}) {
		return fmt.Errorf("contact point '%s' is currently used by a notification policy", name)
	}
	data, err := json.Marshal(revision.cfg)
	if err != nil {
		return err
	}
	return ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		target := &apimodels.EmbeddedContactPoint{
			UID: uid,
		}
		err := ecp.provenanceStore.DeleteProvenance(ctx, target, orgID)
		if err != nil {
			return err
		}
		return ecp.amStore.UpdateAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(data),
			FetchedConfigurationHash:  revision.concurrencyToken,
			ConfigurationVersion:      revision.version,
			Default:                   false,
			OrgID:                     orgID,
		})
	})
}

func isContactPointInUse(name string, routes []*apimodels.Route) bool {
	if len(routes) == 0 {
		return false
	}
	for _, route := range routes {
		if route.Receiver == name {
			return true
		}
		if isContactPointInUse(name, route.Routes) {
			return true
		}
	}
	return false
}

func (ecp *ContactPointService) decryptValue(value string) (string, error) {
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

func (ecp *ContactPointService) encryptValue(value string) (string, error) {
	encryptedData, err := ecp.encryptionService.Encrypt(context.Background(), []byte(value), secrets.WithoutScope())
	if err != nil {
		return "", fmt.Errorf("failed to encrypt secure settings: %w", err)
	}
	return base64.StdEncoding.EncodeToString(encryptedData), nil
}
