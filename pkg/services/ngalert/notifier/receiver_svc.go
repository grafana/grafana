package notifier

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/exp/maps"

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
	ErrReceiverInUse = errutil.Conflict("alerting.notifications.receivers.used").MustTemplate(
		"Receiver is used by '{{ .Public.UsedBy }}'",
		errutil.WithPublic("Receiver is used by {{ .Public.UsedBy }}"),
	)
	ErrReceiverVersionConflict = errutil.Conflict("alerting.notifications.receivers.conflict").MustTemplate(
		"Provided version '{{ .Public.Version }}' of receiver '{{ .Public.Name }}' does not match current version '{{ .Public.CurrentVersion }}'",
		errutil.WithPublic("Provided version '{{ .Public.Version }}' of receiver '{{ .Public.Name }}' does not match current version '{{ .Public.CurrentVersion }}'"),
	)
)

// ReceiverService is the service for managing alertmanager receivers.
type ReceiverService struct {
	authz                  receiverAccessControlService
	provisioningStore      provisoningStore
	cfgStore               alertmanagerConfigStore
	ruleNotificationsStore alertRuleNotificationSettingsStore
	encryptionService      secretService
	xact                   transactionManager
	log                    log.Logger
	provenanceValidator    validation.ProvenanceStatusTransitionValidator
}

type alertRuleNotificationSettingsStore interface {
	RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string) (int, error)
	ListNotificationSettings(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error)
}

type secretService interface {
	Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error)
	Decrypt(ctx context.Context, payload []byte) ([]byte, error)
}

// receiverAccessControlService provides access control for receivers.
type receiverAccessControlService interface {
	FilterRead(context.Context, identity.Requester, ...*models.Receiver) ([]*models.Receiver, error)
	AuthorizeRead(context.Context, identity.Requester, *models.Receiver) error
	FilterReadDecrypted(context.Context, identity.Requester, ...*models.Receiver) ([]*models.Receiver, error)
	AuthorizeReadDecrypted(context.Context, identity.Requester, *models.Receiver) error
	HasList(ctx context.Context, user identity.Requester) (bool, error)

	AuthorizeCreate(context.Context, identity.Requester) error
	AuthorizeUpdate(context.Context, identity.Requester, *models.Receiver) error
	AuthorizeDeleteByUID(context.Context, identity.Requester, string) error
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
	ruleNotificationsStore alertRuleNotificationSettingsStore,
	encryptionService secretService,
	xact transactionManager,
	log log.Logger,
) *ReceiverService {
	return &ReceiverService{
		authz:                  authz,
		provisioningStore:      provisioningStore,
		cfgStore:               cfgStore,
		ruleNotificationsStore: ruleNotificationsStore,
		encryptionService:      encryptionService,
		xact:                   xact,
		log:                    log,
		provenanceValidator:    validation.ValidateProvenanceRelaxed,
	}
}

// GetReceiver returns a receiver by name.
// The receiver's secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceiver(ctx context.Context, q models.GetReceiverQuery, user identity.Requester) (*models.Receiver, error) {
	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}
	postable, err := revision.GetReceiver(legacy_storage.NameToUid(q.Name))
	if err != nil {
		return nil, err
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}
	rcv, err := PostableApiReceiverToReceiver(postable, getReceiverProvenance(storedProvenances, postable))
	if err != nil {
		return nil, err
	}

	auth := rs.authz.AuthorizeReadDecrypted
	if !q.Decrypt {
		auth = rs.authz.AuthorizeRead
	}
	if err := auth(ctx, user, rcv); err != nil {
		return nil, err
	}

	rs.decryptOrRedactSecureSettings(ctx, rcv, q.Decrypt)

	return rcv, nil
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]*models.Receiver, error) {
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
	receivers, err := PostableApiReceiversToReceivers(postables, storedProvenances)
	if err != nil {
		return nil, err
	}

	filterFn := rs.authz.FilterReadDecrypted
	if !q.Decrypt {
		filterFn = rs.authz.FilterRead
	}
	filtered, err := filterFn(ctx, user, receivers...)
	if err != nil {
		return nil, err
	}

	for _, r := range filtered {
		rs.decryptOrRedactSecureSettings(ctx, r, q.Decrypt)
	}

	return limitOffset(filtered, q.Offset, q.Limit), nil
}

// ListReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name.
// This offers an looser permissions compared to GetReceivers. When a user doesn't have read access it will check for list access instead of returning an empty list.
// If the users has list access, all receiver settings will be removed from the response. This option is for backwards compatibility with the v1/receivers endpoint
// and should be removed when FGAC is fully implemented.
func (rs *ReceiverService) ListReceivers(ctx context.Context, q models.ListReceiversQuery, user identity.Requester) ([]*models.Receiver, error) { // TODO: Remove this method with FGAC.
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

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}
	receivers, err := PostableApiReceiversToReceivers(postables, storedProvenances)
	if err != nil {
		return nil, err
	}

	if !listAccess {
		var err error
		receivers, err = rs.authz.FilterRead(ctx, user, receivers...)
		if err != nil {
			return nil, err
		}
	}

	// Remove settings.
	for _, r := range receivers {
		for _, integration := range r.Integrations {
			integration.Settings = nil
			integration.SecureSettings = nil
			integration.DisableResolveMessage = false
		}
	}

	return limitOffset(receivers, q.Offset, q.Limit), nil
}

// DeleteReceiver deletes a receiver by uid.
// UID field currently does not exist, we assume the uid is a particular hashed value of the receiver name.
func (rs *ReceiverService) DeleteReceiver(ctx context.Context, uid string, callerProvenance definitions.Provenance, version string, orgID int64, user identity.Requester) error {
	if err := rs.authz.AuthorizeDeleteByUID(ctx, user, uid); err != nil {
		return err
	}
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return err
	}
	postable, err := revision.GetReceiver(uid)
	if err != nil {
		if errors.Is(err, legacy_storage.ErrReceiverNotFound) {
			return nil
		}
		return err
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, orgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return err
	}
	existing, err := PostableApiReceiverToReceiver(postable, getReceiverProvenance(storedProvenances, postable))
	if err != nil {
		return err
	}

	// Check optimistic concurrency.
	// Optimistic concurrency is optional for delete operations, but we still check it if a version is provided.
	if version != "" {
		err = rs.checkOptimisticConcurrency(existing, version)
		if err != nil {
			return err
		}
	} else {
		rs.log.Debug("ignoring optimistic concurrency check because version was not provided", "receiver", existing.Name, "operation", "delete")
	}

	if err := rs.provenanceValidator(existing.Provenance, models.Provenance(callerProvenance)); err != nil {
		return err
	}

	usedByRoutes := revision.ReceiverNameUsedByRoutes(existing.Name)
	usedByRules, err := rs.UsedByRules(ctx, orgID, existing.Name)
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
		return rs.deleteProvenances(ctx, orgID, existing.Integrations)
	})
}

func (rs *ReceiverService) CreateReceiver(ctx context.Context, r *models.Receiver, orgID int64, user identity.Requester) (*models.Receiver, error) {
	if err := rs.authz.AuthorizeCreate(ctx, user); err != nil {
		return nil, err
	}

	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	createdReceiver := r.Clone()
	err = createdReceiver.Encrypt(rs.encryptor(ctx))
	if err != nil {
		return nil, err
	}

	if err := createdReceiver.Validate(rs.decryptor(ctx)); err != nil {
		return nil, legacy_storage.MakeErrReceiverInvalid(err)
	}

	err = revision.CreateReceiver(&createdReceiver)
	if err != nil {
		return nil, err
	}
	createdReceiver.Version = createdReceiver.Fingerprint()

	err = rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}
		return rs.setReceiverProvenance(ctx, orgID, &createdReceiver)
	})
	if err != nil {
		return nil, err
	}
	return &createdReceiver, nil
}

func (rs *ReceiverService) UpdateReceiver(ctx context.Context, r *models.Receiver, storedSecureFields map[string][]string, orgID int64, user identity.Requester) (*models.Receiver, error) {
	// TODO: To support receiver renaming, we need to consider permissions on old and new UID since UIDs are tied to names.
	if err := rs.authz.AuthorizeUpdate(ctx, user, r); err != nil {
		return nil, err
	}

	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}
	postable, err := revision.GetReceiver(r.GetUID())
	if err != nil {
		return nil, err
	}

	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, orgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}
	existing, err := PostableApiReceiverToReceiver(postable, getReceiverProvenance(storedProvenances, postable))
	if err != nil {
		return nil, err
	}

	// Check optimistic concurrency.
	err = rs.checkOptimisticConcurrency(existing, r.Version)
	if err != nil {
		return nil, err
	}

	if err := rs.provenanceValidator(existing.Provenance, r.Provenance); err != nil {
		return nil, err
	}

	// We need to perform two important steps to process settings on an updated integration:
	// 1. Encrypt new or updated secret fields as they will arrive in plain text.
	// 2. For updates, callers do not re-send unchanged secure settings and instead mark them in SecureFields. We need
	//      to load these secure settings from the existing integration.
	updatedReceiver := r.Clone()
	err = updatedReceiver.Encrypt(rs.encryptor(ctx))
	if err != nil {
		return nil, err
	}
	if len(storedSecureFields) > 0 {
		updatedReceiver.WithExistingSecureFields(existing, storedSecureFields)
	}

	if err := updatedReceiver.Validate(rs.decryptor(ctx)); err != nil {
		return nil, legacy_storage.MakeErrReceiverInvalid(err)
	}

	err = revision.UpdateReceiver(&updatedReceiver)
	if err != nil {
		return nil, err
	}
	updatedReceiver.Version = updatedReceiver.Fingerprint()

	err = rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		// If the name of the receiver changed, we must update references to it in both routes and notification settings.
		// TODO: Needs to check provenance status compatibility: For example, if we rename a receiver via UI but rules are provisioned, this call should be rejected.
		if existing.Name != r.Name {
			affected, err := rs.ruleNotificationsStore.RenameReceiverInNotificationSettings(ctx, orgID, existing.Name, r.Name)
			if err != nil {
				return err
			}
			if affected > 0 {
				rs.log.Info("Renamed receiver in notification settings", "oldName", existing.Name, "newName", r.Name, "affectedSettings", affected)
			}
			revision.RenameReceiverInRoutes(existing.Name, r.Name)
		}

		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}
		err = rs.deleteProvenances(ctx, orgID, removedIntegrations(existing, &updatedReceiver))
		if err != nil {
			return err
		}

		return rs.setReceiverProvenance(ctx, orgID, &updatedReceiver)
	})
	if err != nil {
		return nil, err
	}
	return &updatedReceiver, nil
}

func (rs *ReceiverService) UsedByRules(ctx context.Context, orgID int64, name string) ([]models.AlertRuleKey, error) {
	keys, err := rs.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, ReceiverName: name})
	if err != nil {
		return nil, err
	}

	return maps.Keys(keys), nil
}

func removedIntegrations(old, new *models.Receiver) []*models.Integration {
	updatedUIDs := make(map[string]struct{}, len(new.Integrations))
	for _, integration := range new.Integrations {
		updatedUIDs[integration.UID] = struct{}{}
	}
	removed := make([]*models.Integration, 0)
	for _, existingIntegration := range old.Integrations {
		if _, ok := updatedUIDs[existingIntegration.UID]; !ok {
			removed = append(removed, existingIntegration)
		}
	}
	return removed
}

func (rs *ReceiverService) setReceiverProvenance(ctx context.Context, orgID int64, receiver *models.Receiver) error {
	// Add provenance for all integrations in the receiver.
	for _, integration := range receiver.Integrations {
		target := definitions.EmbeddedContactPoint{UID: integration.UID}
		if err := rs.provisioningStore.SetProvenance(ctx, &target, orgID, receiver.Provenance); err != nil { // TODO: Should we set ProvenanceNone?
			return err
		}
	}
	return nil
}

func (rs *ReceiverService) deleteProvenances(ctx context.Context, orgID int64, integrations []*models.Integration) error {
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
	if decrypt {
		err := recv.Decrypt(rs.decryptor(ctx))
		if err != nil {
			rs.log.Warn("failed to decrypt secure settings", "name", recv.Name, "error", err)
		}
	} else {
		recv.Redact(rs.redactor())
	}
}

// decryptor returns a models.DecryptFn that decrypts a secure setting. If decryption fails, the fallback value is used.
func (rs *ReceiverService) decryptor(ctx context.Context) models.DecryptFn {
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

// redactor returns a models.RedactFn that redacts a secure setting.
func (rs *ReceiverService) redactor() models.RedactFn {
	return func(value string) string {
		return definitions.RedactedValue
	}
}

// encryptor creates an encrypt function that delegates to secrets.Service and returns the base64 encoded result.
func (rs *ReceiverService) encryptor(ctx context.Context) models.EncryptFn {
	return func(payload string) (string, error) {
		s, err := rs.encryptionService.Encrypt(ctx, []byte(payload), secrets.WithoutScope())
		if err != nil {
			return "", err
		}
		return base64.StdEncoding.EncodeToString(s), nil
	}
}

// checkOptimisticConcurrency checks if the existing receiver's version matches the desired version.
func (rs *ReceiverService) checkOptimisticConcurrency(receiver *models.Receiver, desiredVersion string) error {
	if receiver.Version != desiredVersion {
		return makeErrReceiverVersionConflict(receiver, desiredVersion)
	}
	return nil
}

// limitOffset returns a subslice of items with the given offset and limit. Returns the same underlying array, not a copy.
func limitOffset[T any](items []T, offset, limit int) []T {
	if limit == 0 && offset == 0 {
		return items
	}
	if offset >= len(items) {
		return nil
	}
	if offset+limit >= len(items) {
		return items[offset:]
	}
	if limit == 0 {
		limit = len(items) - offset
	}
	return items[offset : offset+limit]
}

func makeReceiverInUseErr(usedByRoutes bool, rules []models.AlertRuleKey) error {
	uids := make([]string, 0, len(rules))
	for _, key := range rules {
		uids = append(uids, key.UID)
	}

	var usedBy []string
	data := make(map[string]any)
	if len(uids) > 0 {
		usedBy = append(usedBy, fmt.Sprintf("%d rule(s)", len(uids)))
		data["UsedByRules"] = uids
	}
	if usedByRoutes {
		usedBy = append(usedBy, "one or more routes")
		data["UsedByRoutes"] = true
	}
	if len(usedBy) > 0 {
		data["UsedBy"] = strings.Join(usedBy, ", ")
	}

	return ErrReceiverInUse.Build(errutil.TemplateData{
		Public: data,
		Error:  nil,
	})
}

func makeErrReceiverVersionConflict(current *models.Receiver, desiredVersion string) error {
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"Version":        desiredVersion,
			"CurrentVersion": current.Version,
			"Name":           current.Name,
		},
	}
	return ErrReceiverVersionConflict.Build(data)
}
