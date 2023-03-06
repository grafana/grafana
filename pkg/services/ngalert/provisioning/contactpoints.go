package provisioning

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
)

type ContactPointService struct {
	amStore           AMConfigStore
	encryptionService secrets.Service
	provenanceStore   ProvisioningStore
	xact              TransactionManager
	log               log.Logger
}

func NewContactPointService(store AMConfigStore, encryptionService secrets.Service,
	provenanceStore ProvisioningStore, xact TransactionManager, log log.Logger) *ContactPointService {
	return &ContactPointService{
		amStore:           store,
		encryptionService: encryptionService,
		provenanceStore:   provenanceStore,
		xact:              xact,
		log:               log,
	}
}

type ContactPointQuery struct {
	// Optionally filter by name.
	Name  string
	OrgID int64
}

func (ecp *ContactPointService) GetContactPoints(ctx context.Context, q ContactPointQuery) ([]apimodels.EmbeddedContactPoint, error) {
	revision, err := getLastConfiguration(ctx, q.OrgID, ecp.amStore)
	if err != nil {
		return nil, err
	}
	provenances, err := ecp.provenanceStore.GetProvenances(ctx, q.OrgID, "contactPoint")
	if err != nil {
		return nil, err
	}
	contactPoints := []apimodels.EmbeddedContactPoint{}
	for _, contactPoint := range revision.cfg.GetGrafanaReceiverMap() {
		if q.Name != "" && contactPoint.Name != q.Name {
			continue
		}

		simpleJson, err := simplejson.NewJson(contactPoint.Settings)
		if err != nil {
			return nil, err
		}
		embeddedContactPoint := apimodels.EmbeddedContactPoint{
			UID:                   contactPoint.UID,
			Type:                  contactPoint.Type,
			Name:                  contactPoint.Name,
			DisableResolveMessage: contactPoint.DisableResolveMessage,
			Settings:              simpleJson,
		}
		if val, exists := provenances[embeddedContactPoint.UID]; exists && val != "" {
			embeddedContactPoint.Provenance = string(val)
		}
		for k, v := range contactPoint.SecureSettings {
			decryptedValue, err := ecp.decryptValue(v)
			if err != nil {
				ecp.log.Warn("decrypting value failed", "error", err.Error())
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

// getContactPointDecrypted is an internal-only function that gets full contact point info, included encrypted fields.
// nil is returned if no matching contact point exists.
func (ecp *ContactPointService) getContactPointDecrypted(ctx context.Context, orgID int64, uid string) (apimodels.EmbeddedContactPoint, error) {
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}
	for _, receiver := range revision.cfg.GetGrafanaReceiverMap() {
		if receiver.UID != uid {
			continue
		}
		simpleJson, err := simplejson.NewJson(receiver.Settings)
		if err != nil {
			return apimodels.EmbeddedContactPoint{}, err
		}
		embeddedContactPoint := apimodels.EmbeddedContactPoint{
			UID:                   receiver.UID,
			Type:                  receiver.Type,
			Name:                  receiver.Name,
			DisableResolveMessage: receiver.DisableResolveMessage,
			Settings:              simpleJson,
		}
		for k, v := range receiver.SecureSettings {
			decryptedValue, err := ecp.decryptValue(v)
			if err != nil {
				ecp.log.Warn("decrypting value failed", "error", err.Error())
				continue
			}
			if decryptedValue == "" {
				continue
			}
			embeddedContactPoint.Settings.Set(k, decryptedValue)
		}
		return embeddedContactPoint, nil
	}
	return apimodels.EmbeddedContactPoint{}, fmt.Errorf("%w: contact point with uid '%s' not found", ErrNotFound, uid)
}

func (ecp *ContactPointService) CreateContactPoint(ctx context.Context, orgID int64,
	contactPoint apimodels.EmbeddedContactPoint, provenance models.Provenance) (apimodels.EmbeddedContactPoint, error) {
	if err := contactPoint.Valid(ecp.encryptionService.GetDecryptedValue); err != nil {
		return apimodels.EmbeddedContactPoint{}, fmt.Errorf("%w: %s", ErrValidation, err.Error())
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

	if contactPoint.UID == "" {
		contactPoint.UID = util.GenerateShortUID()
	}

	jsonData, err := contactPoint.Settings.MarshalJSON()
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}

	grafanaReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              jsonData,
		SecureSettings:        extractedSecrets,
	}

	receiverFound := false
	for _, receiver := range revision.cfg.AlertmanagerConfig.Receivers {
		// check if uid is already used in receiver
		for _, rec := range receiver.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if grafanaReceiver.UID == rec.UID {
				return apimodels.EmbeddedContactPoint{}, fmt.Errorf(
					"receiver configuration with UID '%s' already exist in contact point '%s'. Please use unique identifiers for receivers across all contact points",
					rec.UID,
					rec.Name)
			}
		}
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
		err = PersistConfig(ctx, ecp.amStore, &models.SaveAlertmanagerConfigurationCmd{
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
	if contactPoint.Settings == nil {
		return fmt.Errorf("%w: %s", ErrValidation, "settings should not be empty")
	}
	rawContactPoint, err := ecp.getContactPointDecrypted(ctx, orgID, contactPoint.UID)
	if err != nil {
		return err
	}
	secretKeys, err := contactPoint.SecretKeys()
	if err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}
	for _, secretKey := range secretKeys {
		secretValue := contactPoint.Settings.Get(secretKey).MustString()
		if secretValue == apimodels.RedactedValue {
			contactPoint.Settings.Set(secretKey, rawContactPoint.Settings.Get(secretKey).MustString())
		}
	}

	// validate merged values
	if err := contactPoint.Valid(ecp.encryptionService.GetDecryptedValue); err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
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

	jsonData, err := contactPoint.Settings.MarshalJSON()
	if err != nil {
		return err
	}
	mergedReceiver := &apimodels.PostableGrafanaReceiver{
		UID:                   contactPoint.UID,
		Name:                  contactPoint.Name,
		Type:                  contactPoint.Type,
		DisableResolveMessage: contactPoint.DisableResolveMessage,
		Settings:              jsonData,
		SecureSettings:        extractedSecrets,
	}
	// save to store
	revision, err := getLastConfiguration(ctx, orgID, ecp.amStore)
	if err != nil {
		return err
	}

	configModified := stitchReceiver(revision.cfg, mergedReceiver)
	if !configModified {
		return fmt.Errorf("contact point with uid '%s' not found", mergedReceiver.UID)
	}

	data, err := json.Marshal(revision.cfg)
	if err != nil {
		return err
	}
	return ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = PersistConfig(ctx, ecp.amStore, &models.SaveAlertmanagerConfigurationCmd{
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
		return PersistConfig(ctx, ecp.amStore, &models.SaveAlertmanagerConfigurationCmd{
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

// stitchReceiver modifies a receiver, target, in an alertmanager config. It modifies the given config in-place.
// Returns true if the config was altered in any way, and false otherwise.
func stitchReceiver(cfg *apimodels.PostableUserConfig, target *apimodels.PostableGrafanaReceiver) bool {
	// Algorithm to fix up receivers. Receivers are very complex and depend heavily on internal consistency.
	// All receivers in a given receiver group have the same name. We must maintain this across renames.
	configModified := false
groupLoop:
	for _, receiverGroup := range cfg.AlertmanagerConfig.Receivers {
		// Does the current group contain the grafana receiver we're interested in?
		for i, grafanaReceiver := range receiverGroup.GrafanaManagedReceivers {
			if grafanaReceiver.UID == target.UID {
				// If it's a basic field change, simply replace it. Done!
				//
				// NOTE:
				// In a "normal" database, receiverGroup.Name should always == grafanaReceiver.Name.
				// Check it regardless.
				// If these values are out of sync due to some bug elsewhere in the code, let's fix it up.
				// Our receiver group fixing logic below will handle it.
				if grafanaReceiver.Name == target.Name && receiverGroup.Name == grafanaReceiver.Name {
					receiverGroup.GrafanaManagedReceivers[i] = target
					configModified = true
					break groupLoop
				}

				// If we're renaming, we'll need to fix up the macro receiver group for consistency.
				// Firstly, if we're the only receiver in the group, simply rename the group to match. Done!
				if len(receiverGroup.GrafanaManagedReceivers) == 1 {
					replaceReferences(receiverGroup.Name, target.Name, cfg.AlertmanagerConfig.Route)
					receiverGroup.Name = target.Name
					receiverGroup.GrafanaManagedReceivers[i] = target
					configModified = true
					break groupLoop
				}

				// Otherwise, we only want to rename the receiver we are touching... NOT all of them.
				// Check to see whether a different group with the name we want already exists.
				for i, candidateExistingGroup := range cfg.AlertmanagerConfig.Receivers {
					// If so, put our modified receiver into that group. Done!
					if candidateExistingGroup.Name == target.Name {
						// Drop it from the old group...
						receiverGroup.GrafanaManagedReceivers = append(receiverGroup.GrafanaManagedReceivers[:i], receiverGroup.GrafanaManagedReceivers[i+1:]...)
						// Add the modified receiver to the new group...
						candidateExistingGroup.GrafanaManagedReceivers = append(candidateExistingGroup.GrafanaManagedReceivers, target)
						configModified = true
						break groupLoop
					}
				}

				// Doesn't exist? Create a new group just for the receiver.
				newGroup := &apimodels.PostableApiReceiver{
					Receiver: config.Receiver{
						Name: target.Name,
					},
					PostableGrafanaReceivers: apimodels.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*apimodels.PostableGrafanaReceiver{
							target,
						},
					},
				}
				cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, newGroup)
				// Drop it from the old spot.
				receiverGroup.GrafanaManagedReceivers = append(receiverGroup.GrafanaManagedReceivers[:i], receiverGroup.GrafanaManagedReceivers[i+1:]...)
				configModified = true
				break groupLoop
			}
		}
	}

	return configModified
}

func replaceReferences(oldName, newName string, routes ...*apimodels.Route) {
	if len(routes) == 0 {
		return
	}
	for _, route := range routes {
		if route.Receiver == oldName {
			route.Receiver = newName
		}
		replaceReferences(oldName, newName, route.Routes...)
	}
}
