package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	// ErrPermissionDenied is returned when the user does not have permission to perform the requested action.
	ErrPermissionDenied = errors.New("permission denied") // TODO: convert to errutil
	// ErrNotFound is returned when the requested resource does not exist.
	ErrNotFound = errors.New("not found") // TODO: convert to errutil
)

var (
	ErrReceiverInUse   = errutil.Conflict("alerting.notifications.receiver.used", errutil.WithPublicMessage("Receiver is used by one or many notification policies"))
	ErrVersionConflict = errutil.Conflict("alerting.notifications.receiver.conflict")
)

// ReceiverService is the service for managing alertmanager receivers.
type ReceiverService struct {
	ac                accesscontrol.AccessControl
	provisioningStore provisoningStore
	cfgStore          configStore
	encryptionService secrets.Service
	xact              transactionManager
	log               log.Logger
	validator         validation.ProvenanceStatusTransitionValidator
}

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

type provisoningStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

func NewReceiverService(
	ac accesscontrol.AccessControl,
	cfgStore configStore,
	provisioningStore provisoningStore,
	encryptionService secrets.Service,
	xact transactionManager,
	log log.Logger,
) *ReceiverService {
	return &ReceiverService{
		ac:                ac,
		provisioningStore: provisioningStore,
		cfgStore:          cfgStore,
		encryptionService: encryptionService,
		xact:              xact,
		log:               log,
		validator:         validation.ValidateProvenanceRelaxed,
	}
}

func (rs *ReceiverService) shouldDecrypt(ctx context.Context, user identity.Requester, reqDecrypt bool) (bool, error) {
	decryptAccess, err := rs.hasReadDecrypted(ctx, user)
	if err != nil {
		return false, err
	}

	if reqDecrypt && !decryptAccess {
		return false, ErrPermissionDenied
	}

	return decryptAccess && reqDecrypt, nil
}

// hasReadDecrypted checks if the user has permission to read decrypted secure settings.
func (rs *ReceiverService) hasReadDecrypted(ctx context.Context, user identity.Requester) (bool, error) {
	return rs.ac.Evaluate(ctx, user, accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversReadSecrets),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets), // TODO: Add scope all when we implement FGAC.
	))
}

// hasReadRedacted checks if the user has permission to read redacted secure settings.
func (rs *ReceiverService) hasReadRedacted(ctx context.Context, user identity.Requester) (bool, error) {
	return rs.ac.Evaluate(ctx, user, accesscontrol.EvalAny(
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningRead),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsProvisioningRead),
		accesscontrol.EvalPermission(accesscontrol.ActionAlertingNotificationsRead),
		//accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversRead, ScopeReceiversProvider.GetResourceAllScope()), // TODO: Add new permissions.
		//accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversReadSecrets, ScopeReceiversProvider.GetResourceAllScope(),
	))
}

// hasList checks if the user has permission to list receivers.
func (rs *ReceiverService) hasList(ctx context.Context, user identity.Requester) (bool, error) {
	return rs.ac.Evaluate(ctx, user, accesscontrol.EvalPermission(accesscontrol.ActionAlertingReceiversList))
}

// GetReceiver returns a receiver by name.
// The receiver's secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceiver(ctx context.Context, q models.GetReceiverQuery, user identity.Requester) (definitions.GettableApiReceiver, error) {
	if q.Decrypt && user == nil {
		return definitions.GettableApiReceiver{}, ErrPermissionDenied
	}

	baseCfg, err := rs.cfgStore.GetLatestAlertmanagerConfiguration(ctx, q.OrgID)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	cfg := definitions.PostableUserConfig{}
	err = json.Unmarshal([]byte(baseCfg.AlertmanagerConfiguration), &cfg)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	provenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	receivers := cfg.AlertmanagerConfig.Receivers
	for _, r := range receivers {
		if r.Name == q.Name {
			decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
			if err != nil {
				return definitions.GettableApiReceiver{}, err
			}
			decryptFn := rs.decryptOrRedact(ctx, decrypt, q.Name, "")

			return PostableToGettableApiReceiver(r, provenances, decryptFn, false)
		}
	}

	return definitions.GettableApiReceiver{}, ErrNotFound
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) {
	if q.Decrypt && user == nil {
		return nil, ErrPermissionDenied
	}

	baseCfg, err := rs.cfgStore.GetLatestAlertmanagerConfiguration(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	cfg := definitions.PostableUserConfig{}
	err = json.Unmarshal([]byte(baseCfg.AlertmanagerConfiguration), &cfg)
	if err != nil {
		return nil, err
	}

	provenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}

	readRedactedAccess, err := rs.hasReadRedacted(ctx, user)
	if err != nil {
		return nil, err
	}

	listAccess, err := rs.hasList(ctx, user)
	if err != nil {
		return nil, err
	}

	// User doesn't have any permissions on the receivers.
	// This is mostly a safeguard as it should not be possible with current API endpoints + middleware authentication.
	if !listAccess && !readRedactedAccess {
		return nil, ErrPermissionDenied
	}

	var output []definitions.GettableApiReceiver
	for i := q.Offset; i < len(cfg.AlertmanagerConfig.Receivers); i++ {
		r := cfg.AlertmanagerConfig.Receivers[i]
		if len(q.Names) > 0 && !slices.Contains(q.Names, r.Name) {
			continue
		}

		decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
		if err != nil {
			return nil, err
		}

		decryptFn := rs.decryptOrRedact(ctx, decrypt, r.Name, "")

		// Only has permission to list. This reduces from:
		// - Has List permission
		// - Doesn't have ReadRedacted (or ReadDecrypted permission since it's a subset).
		listOnly := !readRedactedAccess

		res, err := PostableToGettableApiReceiver(r, provenances, decryptFn, listOnly)
		if err != nil {
			return nil, err
		}

		output = append(output, res)
		// stop if we have reached the limit or we have found all the requested receivers
		if (len(output) == q.Limit && q.Limit > 0) || (len(output) == len(q.Names)) {
			break
		}
	}

	return output, nil
}

// DeleteReceiver deletes a receiver by uid.
// UID field currently does not exist, we assume the uid is a particular hashed value of the receiver name.
func (rs *ReceiverService) DeleteReceiver(ctx context.Context, uid string, orgID int64, callerProvenance definitions.Provenance, version string) error {
	//TODO: Check delete permissions.
	baseCfg, err := rs.cfgStore.GetLatestAlertmanagerConfiguration(ctx, orgID)
	if err != nil {
		return err
	}

	cfg := definitions.PostableUserConfig{}
	err = json.Unmarshal([]byte(baseCfg.AlertmanagerConfiguration), &cfg)
	if err != nil {
		return err
	}

	idx, recv := getReceiverByUID(cfg, uid)
	if recv == nil {
		return ErrNotFound // TODO: nil?
	}

	// TODO: Implement + check optimistic concurrency.

	storedProvenance, err := rs.getContactPointProvenance(ctx, recv, orgID)
	if err != nil {
		return err
	}

	if err := rs.validator(storedProvenance, models.Provenance(callerProvenance)); err != nil {
		return err
	}

	if isReceiverInUse(recv.Name, []*definitions.Route{cfg.AlertmanagerConfig.Route}) {
		return ErrReceiverInUse.Errorf("")
	}

	// Remove the receiver from the configuration.
	cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers[:idx], cfg.AlertmanagerConfig.Receivers[idx+1:]...)

	return rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		serialized, err := json.Marshal(cfg)
		if err != nil {
			return err
		}
		cmd := models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: string(serialized),
			ConfigurationVersion:      baseCfg.ConfigurationVersion,
			FetchedConfigurationHash:  baseCfg.ConfigurationHash,
			Default:                   false,
			OrgID:                     orgID,
		}

		err = rs.cfgStore.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}

		// Remove provenance for all integrations in the receiver.
		for _, integration := range recv.GrafanaManagedReceivers {
			target := definitions.EmbeddedContactPoint{UID: integration.UID}
			if err := rs.provisioningStore.DeleteProvenance(ctx, &target, orgID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (rs *ReceiverService) CreateReceiver(ctx context.Context, r definitions.GettableApiReceiver, orgID int64) (definitions.GettableApiReceiver, error) {
	// TODO: Stub
	panic("not implemented")
}

func (rs *ReceiverService) UpdateReceiver(ctx context.Context, r definitions.GettableApiReceiver, orgID int64) (definitions.GettableApiReceiver, error) {
	// TODO: Stub
	panic("not implemented")
}

func (rs *ReceiverService) decryptOrRedact(ctx context.Context, decrypt bool, name, fallback string) func(value string) string {
	return func(value string) string {
		if !decrypt {
			return definitions.RedactedValue
		}

		decoded, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			rs.log.Warn("failed to decode secure setting", "name", name, "error", err)
			return fallback
		}
		decrypted, err := rs.encryptionService.Decrypt(ctx, decoded)
		if err != nil {
			rs.log.Warn("failed to decrypt secure setting", "name", name, "error", err)
			return fallback
		}
		return string(decrypted)
	}
}

// getContactPointProvenance determines the provenance of a definitions.PostableApiReceiver based on the provenance of its integrations.
func (rs *ReceiverService) getContactPointProvenance(ctx context.Context, r *definitions.PostableApiReceiver, orgID int64) (models.Provenance, error) {
	if len(r.GrafanaManagedReceivers) == 0 {
		return models.ProvenanceNone, nil
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, orgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return "", err
	}

	// Current provisioning works on the integration level, so we need some way to determine the provenance of the
	// entire receiver. All integrations in a receiver should have the same provenance, but we don't want to rely on
	// this assumption in case the first provenance is None and a later one is not. To this end, we return the first
	// non-zero provenance we find.
	for _, contactPoint := range r.GrafanaManagedReceivers {
		if p, exists := storedProvenances[contactPoint.UID]; exists && p != models.ProvenanceNone {
			return p, nil
		}
	}
	return models.ProvenanceNone, nil
}

// getReceiverByUID returns the index and receiver with the given UID.
func getReceiverByUID(cfg definitions.PostableUserConfig, uid string) (int, *definitions.PostableApiReceiver) {
	for i, r := range cfg.AlertmanagerConfig.Receivers {
		if getUID(r) == uid {
			return i, r
		}
	}
	return 0, nil
}

// getUID returns the UID of a PostableApiReceiver.
// Currently, the UID is a hash of the receiver name.
func getUID(t *definitions.PostableApiReceiver) string { // TODO replace to stable UID when we switch to normal storage
	sum := fnv.New64()
	_, _ = sum.Write([]byte(t.Name))
	return fmt.Sprintf("%016x", sum.Sum64())
}

// TODO: Check if the contact point is used directly in an alert rule.
// isReceiverInUse checks if a receiver is used in a route or any of its sub-routes.
func isReceiverInUse(name string, routes []*definitions.Route) bool {
	if len(routes) == 0 {
		return false
	}
	for _, route := range routes {
		if route.Receiver == name {
			return true
		}
		if isReceiverInUse(name, route.Routes) {
			return true
		}
	}
	return false
}
