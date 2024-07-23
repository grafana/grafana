package notifier

import (
	"context"
	"encoding/base64"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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
	authz             receiverAccessControlService
	provisioningStore provisoningStore
	cfgStore          alertmanagerConfigStore
	encryptionService secrets.Service
	xact              transactionManager
	log               log.Logger
	validator         validation.ProvenanceStatusTransitionValidator
}

// receiverAccessControlService provides access control for receivers.
type receiverAccessControlService interface {
	FilterRead(context.Context, identity.Requester, ...*models.Receiver) ([]*models.Receiver, error)
	AuthorizeRead(context.Context, identity.Requester, *models.Receiver) error
	FilterReadDecrypted(context.Context, identity.Requester, ...*models.Receiver) ([]*models.Receiver, error)
	AuthorizeReadDecrypted(context.Context, identity.Requester, *models.Receiver) error
	HasList(ctx context.Context, user identity.Requester) (bool, error)
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
	authz receiverAccessControlService,
	cfgStore alertmanagerConfigStore,
	provisioningStore provisoningStore,
	encryptionService secrets.Service,
	xact transactionManager,
	log log.Logger,
) *ReceiverService {
	return &ReceiverService{
		authz:             authz,
		provisioningStore: provisioningStore,
		cfgStore:          cfgStore,
		encryptionService: encryptionService,
		xact:              xact,
		log:               log,
		validator:         validation.ValidateProvenanceRelaxed,
	}
}

// GetReceiver returns a receiver by name.
// The receiver's secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceiver(ctx context.Context, q models.GetReceiverQuery, user identity.Requester) (definitions.GettableApiReceiver, error) {
	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}
	postable := revision.GetReceiver(legacy_storage.NameToUid(q.Name))
	if postable == nil {
		return definitions.GettableApiReceiver{}, ErrReceiverNotFound.Errorf("")
	}

	auth := rs.authz.AuthorizeReadDecrypted
	if !q.Decrypt {
		auth = rs.authz.AuthorizeRead
	}
	if err := auth(ctx, user, postable); err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	rs.decryptOrRedactSecureSettings(ctx, postable, q.Decrypt)

	return PostableToGettableApiReceiver(postable, storedProvenances)
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) {
	uids := make([]string, 0, len(q.Names))
	for _, name := range q.Names {
		uids = append(uids, legacy_storage.NameToUid(name))
	}

	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}
	postables := revision.GetReceivers(uids)

	filterFn := rs.authz.FilterReadDecrypted
	if !q.Decrypt {
		filterFn = rs.authz.FilterRead
	}
	filtered, err := filterFn(ctx, user, postables...)
	if err != nil {
		return nil, err
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}

	var output []definitions.GettableApiReceiver
	for i := q.Offset; i < len(filtered); i++ {
		r := filtered[i]

		rs.decryptOrRedactSecureSettings(ctx, r, q.Decrypt)
		res, err := PostableToGettableApiReceiver(r, storedProvenances)
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

// ListReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name.
// This offers an looser permissions compared to GetReceivers. When a user doesn't have read access it will check for list access instead of returning an empty list.
// If the users has list access, all receiver settings will be removed from the response. This option is for backwards compatibility with the v1/receivers endpoint
// and should be removed when FGAC is fully implemented.
func (rs *ReceiverService) ListReceivers(ctx context.Context, q models.ListReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) { // TODO: Remove this method with FGAC.
	listAccess, err := rs.authz.HasList(ctx, user)
	if err != nil {
		return nil, err
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

	if !listAccess {
		var err error
		postables, err = rs.authz.FilterRead(ctx, user, postables...)
		if err != nil {
			return nil, err
		}
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}

	var output []definitions.GettableApiReceiver
	for i := q.Offset; i < len(postables); i++ {
		r := postables[i]

		// Remove settings.
		for _, integration := range r.GrafanaManagedReceivers {
			integration.Settings = nil
			integration.SecureSettings = nil
			integration.DisableResolveMessage = false
		}

		res, err := PostableToGettableApiReceiver(r, storedProvenances)
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

func (rs *ReceiverService) decryptOrRedactSecureSettings(ctx context.Context, recv *models.Receiver, decrypt bool) {
	decryptOrRedact := rs.redactor()
	if decrypt {
		decryptOrRedact = rs.decryptor(ctx)
	}
	for _, r := range recv.Integrations {
		for field, val := range r.SecureSettings {
			newVal, err := decryptOrRedact(val)
			if err != nil {
				newVal = ""
				rs.log.Warn("failed to decrypt secure setting", "name", recv.Name, "error", err)
			}
			r.SecureSettings[field] = newVal
		}
	}
}

// decryptor returns a decryptFn that decrypts a secure setting. If decryption fails, the fallback value is used.
func (rs *ReceiverService) decryptor(ctx context.Context) decryptFn {
	return func(value string) (string, error) {
		decoded, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return "", err
		}
		decrypted, err := rs.encryptionService.Decrypt(ctx, decoded)
		if err != nil {
			return "", err
		}
		return string(decrypted), nil
	}
}

// redactor returns a decryptFn that redacts a secure setting.
func (rs *ReceiverService) redactor() decryptFn {
	return func(value string) (string, error) {
		return definitions.RedactedValue, nil
	}
}

type decryptFn = func(value string) (string, error)

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
