package notifier

import (
	"context"
	"encoding/base64"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	ErrReceiverNotFound = errutil.NotFound("alerting.notifications.receiver.notFound")
	ErrReceiverInUse    = errutil.Conflict("alerting.notifications.receiver.used").MustTemplate("Receiver is used by notification policies or alert rules")
)

// ReceiverService is the service for managing alertmanager receivers.
type ReceiverService struct {
	ac                accesscontrol.AccessControl
	provisioningStore provisoningStore
	cfgStore          alertmanagerConfigStore
	encryptionService secrets.Service
	xact              transactionManager
	log               log.Logger
	validator         validation.ProvenanceStatusTransitionValidator
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type provisoningStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

func NewReceiverService(
	ac accesscontrol.AccessControl,
	cfgStore alertmanagerConfigStore,
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
		return false, ac.NewAuthorizationErrorWithPermissions("read any decrypted receiver", nil) // TODO: Replace with authz service.
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
		return definitions.GettableApiReceiver{}, ac.NewAuthorizationErrorWithPermissions("read any decrypted receiver", nil) // TODO: Replace with authz service.
	}

	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}
	postable := revision.GetReceiver(legacy_storage.NameToUid(q.Name))
	if postable == nil {
		return definitions.GettableApiReceiver{}, ErrReceiverNotFound.Errorf("")
	}

	decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}
	decryptFn := rs.decryptOrRedact(ctx, decrypt, q.Name, "")

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	return PostableToGettableApiReceiver(postable, storedProvenances, decryptFn, false)
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) {
	if q.Decrypt && user == nil {
		return nil, ac.NewAuthorizationErrorWithPermissions("read any decrypted receiver", nil) // TODO: Replace with authz service.
	}

	uids := make([]string, 0, len(q.Names))
	for _, name := range q.Names {
		uids = append(uids, legacy_storage.NameToUid(name))
	}

	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}
	postables := revision.GetReceivers(uids)

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
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
		return nil, ac.NewAuthorizationErrorWithPermissions("read any receiver", nil) // TODO: Replace with authz service.
	}

	var output []definitions.GettableApiReceiver
	for i := q.Offset; i < len(postables); i++ {
		r := postables[i]

		decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
		if err != nil {
			return nil, err
		}

		decryptFn := rs.decryptOrRedact(ctx, decrypt, r.Name, "")

		// Only has permission to list. This reduces from:
		// - Has List permission
		// - Doesn't have ReadRedacted (or ReadDecrypted permission since it's a subset).
		listOnly := !readRedactedAccess

		res, err := PostableToGettableApiReceiver(r, storedProvenances, decryptFn, listOnly)
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
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return err
	}
	postable := revision.GetReceiver(uid)
	if postable == nil {
		return ErrReceiverNotFound.Errorf("")
	}

	// TODO: Implement + check optimistic concurrency.

	storedProvenance, err := rs.getContactPointProvenance(ctx, postable, orgID)
	if err != nil {
		return err
	}

	if err := rs.validator(storedProvenance, models.Provenance(callerProvenance)); err != nil {
		return err
	}

	usedByRoutes := revision.ReceiverNameUsedByRoutes(postable.GetName())
	usedByRules, err := rs.UsedByRules(ctx, orgID, uid)
	if err != nil {
		return err
	}

	if usedByRoutes || len(usedByRules) > 0 {
		return makeReceiverInUseErr(usedByRoutes, usedByRules)
	}

	revision.DeleteReceiver(uid)

	return rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}
		return rs.deleteProvenances(ctx, orgID, postable.GrafanaManagedReceivers)
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

func (rs *ReceiverService) UsedByRules(ctx context.Context, orgID int64, uid string) ([]models.AlertRuleKey, error) {
	//TODO: Implement
	return []models.AlertRuleKey{}, nil
}

func (rs *ReceiverService) deleteProvenances(ctx context.Context, orgID int64, integrations []*definition.PostableGrafanaReceiver) error {
	// Delete provenance for all integrations.
	for _, integration := range integrations {
		target := definitions.EmbeddedContactPoint{UID: integration.UID}
		if err := rs.provisioningStore.DeleteProvenance(ctx, &target, orgID); err != nil {
			return err
		}
	}
	return nil
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

func makeReceiverInUseErr(usedByRoutes bool, rules []models.AlertRuleKey) error {
	uids := make([]string, 0, len(rules))
	for _, key := range rules {
		uids = append(uids, key.UID)
	}
	data := make(map[string]any, 2)
	if len(uids) > 0 {
		data["UsedByRules"] = uids
	}
	if usedByRoutes {
		data["UsedByRoutes"] = true
	}

	return ErrReceiverInUse.Build(errutil.TemplateData{
		Public: data,
		Error:  nil,
	})
}
