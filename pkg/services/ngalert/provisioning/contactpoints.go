package provisioning

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleNotificationSettingsStore interface {
	RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string) (int, error)
	ListNotificationSettings(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error)
}

type ContactPointService struct {
	configStore               *alertmanagerConfigStoreImpl
	encryptionService         secrets.Service
	provenanceStore           ProvisioningStore
	notificationSettingsStore AlertRuleNotificationSettingsStore
	xact                      TransactionManager
	receiverService           receiverService
	log                       log.Logger
}

type receiverService interface {
	GetReceivers(ctx context.Context, query models.GetReceiversQuery, user identity.Requester) ([]apimodels.GettableApiReceiver, error)
}

func NewContactPointService(store AMConfigStore, encryptionService secrets.Service,
	provenanceStore ProvisioningStore, xact TransactionManager, receiverService receiverService, log log.Logger,
	nsStore AlertRuleNotificationSettingsStore) *ContactPointService {
	return &ContactPointService{
		configStore: &alertmanagerConfigStoreImpl{
			store: store,
		},
		receiverService:           receiverService,
		encryptionService:         encryptionService,
		provenanceStore:           provenanceStore,
		xact:                      xact,
		log:                       log,
		notificationSettingsStore: nsStore,
	}
}

type ContactPointQuery struct {
	// Optionally filter by name.
	Name  string
	OrgID int64
	// Optionally decrypt secure settings, requires OrgAdmin.
	Decrypt bool
}

// GetContactPoints returns contact points. If q.Decrypt is true and the user is an OrgAdmin, decrypted secure settings are included instead of redacted ones.
func (ecp *ContactPointService) GetContactPoints(ctx context.Context, q ContactPointQuery, u identity.Requester) ([]apimodels.EmbeddedContactPoint, error) {
	receiverQuery := models.GetReceiversQuery{
		OrgID:   q.OrgID,
		Decrypt: q.Decrypt,
	}
	if q.Name != "" {
		receiverQuery.Names = []string{q.Name}
	}

	res, err := ecp.receiverService.GetReceivers(ctx, receiverQuery, u)
	if err != nil {
		return nil, convertRecSvcErr(err)
	}
	grafanaReceivers := []*apimodels.GettableGrafanaReceiver{}
	if q.Name != "" && len(res) > 0 {
		grafanaReceivers = res[0].GettableGrafanaReceivers.GrafanaManagedReceivers // we only expect one receiver group
	} else {
		for _, r := range res {
			grafanaReceivers = append(grafanaReceivers, r.GettableGrafanaReceivers.GrafanaManagedReceivers...)
		}
	}

	contactPoints := make([]apimodels.EmbeddedContactPoint, len(grafanaReceivers))
	for i, gr := range grafanaReceivers {
		contactPoint, err := GettableGrafanaReceiverToEmbeddedContactPoint(gr)
		if err != nil {
			return nil, err
		}

		contactPoints[i] = contactPoint
	}

	sort.SliceStable(contactPoints, func(i, j int) bool {
		switch strings.Compare(contactPoints[i].Name, contactPoints[j].Name) {
		case -1:
			return true
		case 1:
			return false
		}
		return contactPoints[i].UID < contactPoints[j].UID
	})

	return contactPoints, nil
}

// getContactPointDecrypted is an internal-only function that gets full contact point info, included encrypted fields.
// nil is returned if no matching contact point exists.
func (ecp *ContactPointService) getContactPointDecrypted(ctx context.Context, orgID int64, uid string) (apimodels.EmbeddedContactPoint, error) {
	revision, err := ecp.configStore.Get(ctx, orgID)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}
	for _, receiver := range revision.cfg.GetGrafanaReceiverMap() {
		if receiver.UID != uid {
			continue
		}
		embeddedContactPoint, err := PostableGrafanaReceiverToEmbeddedContactPoint(
			receiver,
			models.ProvenanceNone, // TODO should be correct provenance?
			ecp.decryptValueOrRedacted(true, receiver.UID),
		)
		if err != nil {
			return apimodels.EmbeddedContactPoint{}, err
		}
		return embeddedContactPoint, nil
	}
	return apimodels.EmbeddedContactPoint{}, fmt.Errorf("%w: contact point with uid '%s' not found", ErrNotFound, uid)
}

func (ecp *ContactPointService) CreateContactPoint(ctx context.Context, orgID int64,
	contactPoint apimodels.EmbeddedContactPoint, provenance models.Provenance) (apimodels.EmbeddedContactPoint, error) {
	if err := ValidateContactPoint(ctx, contactPoint, ecp.encryptionService.GetDecryptedValue); err != nil {
		return apimodels.EmbeddedContactPoint{}, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := ecp.configStore.Get(ctx, orgID)
	if err != nil {
		return apimodels.EmbeddedContactPoint{}, err
	}

	extractedSecrets, err := RemoveSecretsForContactPoint(&contactPoint)
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
	} else if err := util.ValidateUID(contactPoint.UID); err != nil {
		return apimodels.EmbeddedContactPoint{}, errors.Join(ErrValidation, fmt.Errorf("cannot create contact point with UID '%s': %w", contactPoint.UID, err))
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

	err = ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := ecp.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return ecp.provenanceStore.SetProvenance(ctx, &contactPoint, orgID, provenance)
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
	secretKeys, err := channels_config.GetSecretKeysForContactPointType(contactPoint.Type)
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
	if err := ValidateContactPoint(ctx, contactPoint, ecp.encryptionService.GetDecryptedValue); err != nil {
		return fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := ecp.provenanceStore.GetProvenance(ctx, &contactPoint, orgID)
	if err != nil {
		return err
	}
	if storedProvenance != provenance && storedProvenance != models.ProvenanceNone {
		return fmt.Errorf("cannot change provenance from '%s' to '%s'", storedProvenance, provenance)
	}
	// transform to internal model
	extractedSecrets, err := RemoveSecretsForContactPoint(&contactPoint)
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
	revision, err := ecp.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	configModified, renamedReceiver := stitchReceiver(revision.cfg, mergedReceiver)
	if !configModified {
		return fmt.Errorf("contact point with uid '%s' not found", mergedReceiver.UID)
	}

	err = ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := ecp.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		if renamedReceiver != "" && renamedReceiver != mergedReceiver.Name {
			affected, err := ecp.notificationSettingsStore.RenameReceiverInNotificationSettings(ctx, orgID, renamedReceiver, mergedReceiver.Name)
			if err != nil {
				return err
			}
			if affected > 0 {
				ecp.log.Info("Renamed receiver in notification settings", "oldName", renamedReceiver, "newName", mergedReceiver.Name, "affectedSettings", affected)
			}
		}
		return ecp.provenanceStore.SetProvenance(ctx, &contactPoint, orgID, provenance)
	})
	if err != nil {
		return err
	}
	return nil
}

func (ecp *ContactPointService) DeleteContactPoint(ctx context.Context, orgID int64, uid string) error {
	revision, err := ecp.configStore.Get(ctx, orgID)
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
		return ErrContactPointReferenced
	}

	return ecp.xact.InTransaction(ctx, func(ctx context.Context) error {
		if fullRemoval {
			used, err := ecp.notificationSettingsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, ReceiverName: name})
			if err != nil {
				return fmt.Errorf("failed to query alert rules for reference to the contact point '%s': %w", name, err)
			}
			if len(used) > 0 {
				uids := make([]string, 0, len(used))
				for key := range used {
					uids = append(uids, key.UID)
				}
				ecp.log.Error("Cannot delete contact point because it is used in rule's notification settings", "receiverName", name, "rulesUid", strings.Join(uids, ","))
				return fmt.Errorf("contact point '%s' is currently used in notification settings by one or many alert rules", name)
			}
		}

		if err := ecp.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		target := &apimodels.EmbeddedContactPoint{
			UID: uid,
		}
		return ecp.provenanceStore.DeleteProvenance(ctx, target, orgID)
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

// decryptValueOrRedacted returns a function that decodes a string from Base64 and then decrypts using secrets.Service.
// If argument 'decrypt' is false, then returns definitions.RedactedValue regardless of the decrypted value.
// Otherwise, it returns the decoded and decrypted value. The function returns empty string in the case of errors, which are logged
func (ecp *ContactPointService) decryptValueOrRedacted(decrypt bool, integrationUID string) func(v string) string {
	return func(value string) string {
		decodeValue, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			ecp.log.Warn("Failed to decode secret value from Base64", "error", err.Error(), "integrationUid", integrationUID)
			return ""
		}
		decryptedValue, err := ecp.encryptionService.Decrypt(context.Background(), decodeValue)
		if err != nil {
			ecp.log.Warn("Failed to decrypt secret value", "error", err.Error(), "integrationUid", integrationUID)
			return ""
		}
		if decrypt {
			return string(decryptedValue)
		} else {
			return apimodels.RedactedValue
		}
	}
}

func (ecp *ContactPointService) encryptValue(value string) (string, error) {
	encryptedData, err := ecp.encryptionService.Encrypt(context.Background(), []byte(value), secrets.WithoutScope())
	if err != nil {
		return "", fmt.Errorf("failed to encrypt secure settings: %w", err)
	}
	return base64.StdEncoding.EncodeToString(encryptedData), nil
}

// stitchReceiver modifies a receiver, target, in an alertmanager configStore. It modifies the given configStore in-place.
// Returns true if the configStore was altered in any way, and false otherwise.
// If integration was moved to another group and it was the last in the previous group, the second parameter contains the name of the old group that is gone
func stitchReceiver(cfg *apimodels.PostableUserConfig, target *apimodels.PostableGrafanaReceiver) (bool, string) {
	// Algorithm to fix up receivers. Receivers are very complex and depend heavily on internal consistency.
	// All receivers in a given receiver group have the same name. We must maintain this across renames.
	configModified := false
	renamedReceiver := ""
groupLoop:
	for groupIdx, receiverGroup := range cfg.AlertmanagerConfig.Receivers {
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
					renamedReceiver = receiverGroup.Name
				}

				// Otherwise, we only want to rename the receiver we are touching... NOT all of them.
				// Check to see whether a different group with the name we want already exists.
				for _, candidateExistingGroup := range cfg.AlertmanagerConfig.Receivers {
					// If so, put our modified receiver into that group. Done!
					if candidateExistingGroup.Name == target.Name {
						// Drop it from the old group...
						receiverGroup.GrafanaManagedReceivers = append(receiverGroup.GrafanaManagedReceivers[:i], receiverGroup.GrafanaManagedReceivers[i+1:]...)
						// Add the modified receiver to the new group...
						candidateExistingGroup.GrafanaManagedReceivers = append(candidateExistingGroup.GrafanaManagedReceivers, target)
						configModified = true

						// if the old receiver group turns out to be empty. Remove it.
						if len(receiverGroup.GrafanaManagedReceivers) == 0 {
							cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers[:groupIdx], cfg.AlertmanagerConfig.Receivers[groupIdx+1:]...)
						}
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

	return configModified, renamedReceiver
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

func ValidateContactPoint(ctx context.Context, e apimodels.EmbeddedContactPoint, decryptFunc alertingNotify.GetDecryptedValueFn) error {
	if e.Type == "" {
		return fmt.Errorf("type should not be an empty string")
	}
	if e.Settings == nil {
		return fmt.Errorf("settings should not be empty")
	}
	integration, err := EmbeddedContactPointToGrafanaIntegrationConfig(e)
	if err != nil {
		return err
	}
	_, err = alertingNotify.BuildReceiverConfiguration(ctx, &alertingNotify.APIReceiver{
		GrafanaIntegrations: alertingNotify.GrafanaIntegrations{
			Integrations: []*alertingNotify.GrafanaIntegrationConfig{&integration},
		},
	}, decryptFunc)
	if err != nil {
		return err
	}
	return nil
}

// RemoveSecretsForContactPoint removes all secrets from the contact point's settings and returns them as a map. Returns error if contact point type is not known.
func RemoveSecretsForContactPoint(e *apimodels.EmbeddedContactPoint) (map[string]string, error) {
	s := map[string]string{}
	secretKeys, err := channels_config.GetSecretKeysForContactPointType(e.Type)
	if err != nil {
		return nil, err
	}
	for _, secretKey := range secretKeys {
		secretValue := e.Settings.Get(secretKey).MustString()
		e.Settings.Del(secretKey)
		s[secretKey] = secretValue
	}
	return s, nil
}

// handleWrappedError unwraps an error and wraps it with a new expected error type. If the error is not wrapped, it returns just the expected error.
func handleWrappedError(err error, expected error) error {
	err = errors.Unwrap(err)
	if err == nil {
		return expected
	}
	return fmt.Errorf("%w: %s", expected, err.Error())
}

// convertRecSvcErr converts errors from notifier.ReceiverService to errors expected from ContactPointService.
func convertRecSvcErr(err error) error {
	if errors.Is(err, notifier.ErrPermissionDenied) {
		return handleWrappedError(err, ErrPermissionDenied)
	}
	if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
		return ErrNoAlertmanagerConfiguration.Errorf("")
	}
	return err
}
