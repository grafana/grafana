package notifier

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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

	ErrReceiverDependentResourcesProvenance = errutil.Conflict("alerting.notifications.receivers.usedProvisioned").MustTemplate(
		"Receiver cannot be renamed because it is used by provisioned {{ if .Public.UsedByRules }}alert rules{{ end }}{{ if .Public.UsedByRoutes }}{{ if .Public.UsedByRules }} and {{ end }}notification policies{{ end }}",
		errutil.WithPublic(`Receiver cannot be renamed because it is used by provisioned {{ if .Public.UsedByRules }}alert rules{{ end }}{{ if .Public.UsedByRoutes }}{{ if .Public.UsedByRules }} and {{ end }}notification policies{{ end }}. You must update those resources first using the original provision method.`),
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
	resourcePermissions    ac.ReceiverPermissionsService
	tracer                 tracing.Tracer
}

type alertRuleNotificationSettingsStore interface {
	RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string, validateProvenance func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error)
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

	Access(ctx context.Context, user identity.Requester, receivers ...*models.Receiver) (map[string]models.ReceiverPermissionSet, error)
}

type alertmanagerConfigStore interface {
	Get(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error)
	Save(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64) error
}

type provisoningStore interface {
	GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error)
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
	resourcePermissions ac.ReceiverPermissionsService,
	tracer tracing.Tracer,
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
		resourcePermissions:    resourcePermissions,
		tracer:                 tracer,
	}
}

func (rs *ReceiverService) loadProvenances(ctx context.Context, orgID int64) (map[string]models.Provenance, error) {
	return rs.provisioningStore.GetProvenances(ctx, orgID, (&models.Integration{}).ResourceType())
}

// GetReceiver returns a receiver by name.
// The receiver's secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceiver(ctx context.Context, q models.GetReceiverQuery, user identity.Requester) (*models.Receiver, error) {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.get", trace.WithAttributes(
		attribute.Int64("query_org_id", q.OrgID),
		attribute.String("query_name", q.Name),
		attribute.Bool("query_decrypt", q.Decrypt),
	))
	defer span.End()

	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	prov, err := rs.loadProvenances(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	rcv, err := revision.GetReceiver(legacy_storage.NameToUid(q.Name), prov)
	if err != nil {
		return nil, err
	}

	span.AddEvent("Loaded receiver", trace.WithAttributes(
		attribute.String("concurrency_token", revision.ConcurrencyToken),
	))

	auth := rs.authz.AuthorizeReadDecrypted
	if !q.Decrypt {
		auth = rs.authz.AuthorizeRead
	}
	if err := auth(ctx, user, rcv); err != nil {
		return nil, err
	}

	if q.Decrypt {
		err := rcv.Decrypt(rs.decryptor(ctx))
		if err != nil {
			rs.log.FromContext(ctx).Warn("Failed to decrypt secure settings", "name", rcv.Name, "error", err)
		}
	} else {
		err := rcv.Encrypt(rs.encryptor(ctx))
		if err != nil {
			rs.log.FromContext(ctx).Warn("Failed to encrypt secure settings", "name", rcv.Name, "error", err)
		}
	}

	return rcv, nil
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]*models.Receiver, error) {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.getMany", trace.WithAttributes(
		attribute.Int64("query_org_id", q.OrgID),
		attribute.StringSlice("query_names", q.Names),
		attribute.Int("query_limit", q.Limit),
		attribute.Int("query_offset", q.Offset),
		attribute.Bool("query_decrypt", q.Decrypt),
	))
	defer span.End()

	uids := make([]string, 0, len(q.Names))
	for _, name := range q.Names {
		uids = append(uids, legacy_storage.NameToUid(name))
	}

	revision, err := rs.cfgStore.Get(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	prov, err := rs.loadProvenances(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	receivers, err := revision.GetReceivers(uids, prov)
	if err != nil {
		return nil, err
	}

	span.AddEvent("Loaded receivers", trace.WithAttributes(
		attribute.String("concurrency_token", revision.ConcurrencyToken),
		attribute.Int("count", len(receivers)),
	))

	filterFn := rs.authz.FilterReadDecrypted
	if !q.Decrypt {
		filterFn = rs.authz.FilterRead
	}
	filtered, err := filterFn(ctx, user, receivers...)
	if err != nil {
		return nil, err
	}

	span.AddEvent("Applied access control filter", trace.WithAttributes(
		attribute.Int("count", len(receivers)),
	))

	for _, rcv := range filtered {
		if q.Decrypt {
			err := rcv.Decrypt(rs.decryptor(ctx))
			if err != nil {
				rs.log.FromContext(ctx).Warn("Failed to decrypt secure settings", "name", rcv.Name, "error", err)
			}
		} else {
			err := rcv.Encrypt(rs.encryptor(ctx))
			if err != nil {
				rs.log.FromContext(ctx).Warn("Failed to encrypt secure settings", "name", rcv.Name, "error", err)
			}
		}
	}

	return limitOffset(filtered, q.Offset, q.Limit), nil
}

// DeleteReceiver deletes a receiver by uid.
// UID field currently does not exist, we assume the uid is a particular hashed value of the receiver name.
func (rs *ReceiverService) DeleteReceiver(ctx context.Context, uid string, callerProvenance models.Provenance, version string, orgID int64, user identity.Requester) error {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.delete", trace.WithAttributes(
		attribute.String("receiver_uid", uid),
		attribute.String("receiver_version", version),
	))
	defer span.End()

	if err := rs.authz.AuthorizeDeleteByUID(ctx, user, uid); err != nil {
		return err
	}
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	prov, err := rs.loadProvenances(ctx, orgID)
	if err != nil {
		return err
	}

	existing, err := revision.GetReceiver(uid, prov)
	if err != nil {
		if errors.Is(err, legacy_storage.ErrReceiverNotFound) {
			return nil
		}
		return err
	}

	logger := rs.log.FromContext(ctx).New("receiver", existing.Name, "uid", uid, "version", version, "integrations", existing.GetIntegrationTypes())

	// Check optimistic concurrency.
	// Optimistic concurrency is optional for delete operations, but we still check it if a version is provided.
	if version != "" {
		err = rs.checkOptimisticConcurrency(existing, version)
		if err != nil {
			return err
		}
	} else {
		logger.Debug("Ignoring optimistic concurrency check because version was not provided", "operation", "delete")
	}

	if err := rs.provenanceValidator(existing.Provenance, callerProvenance); err != nil {
		return err
	}

	usedByRoutes := revision.ReceiverNameUsedByRoutes(existing.Name)
	usedByRules, err := rs.UsedByRules(ctx, orgID, existing.Name)
	if err != nil {
		return err
	}

	if usedByRoutes || len(usedByRules) > 0 {
		logger.Warn("Cannot delete receiver because it is used", "used_by_routes", usedByRoutes, "used_by_rules", len(usedByRules))
		return makeReceiverInUseErr(usedByRoutes, usedByRules)
	}

	revision.DeleteReceiver(uid)

	err = rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}
		err = rs.resourcePermissions.DeleteResourcePermissions(ctx, orgID, uid)
		if err != nil {
			logger.Error("Could not delete receiver permissions", "error", err)
		}
		return rs.deleteProvenances(ctx, orgID, existing.Integrations)
	})
	if err != nil {
		return err
	}
	logger.Info("Deleted receiver")
	return nil
}

func (rs *ReceiverService) CreateReceiver(ctx context.Context, r *models.Receiver, orgID int64, user identity.Requester) (result *models.Receiver, err error) {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.create", trace.WithAttributes(
		attribute.String("receiver", r.Name),
		attribute.StringSlice("integrations", r.GetIntegrationTypes()),
	))
	defer span.End()

	if err := rs.authz.AuthorizeCreate(ctx, user); err != nil {
		return nil, err
	}

	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	span.AddEvent("Loaded Alertmanager configuration", trace.WithAttributes(attribute.String("concurrency_token", revision.ConcurrencyToken)))

	createdReceiver := r.Clone()
	err = createdReceiver.Encrypt(rs.encryptor(ctx))
	if err != nil {
		return nil, err
	}

	if err := createdReceiver.Validate(rs.decryptor(ctx)); err != nil {
		span.RecordError(err)
		return nil, legacy_storage.MakeErrReceiverInvalid(err)
	}

	// Generate UID from name.
	createdReceiver.UID = legacy_storage.NameToUid(createdReceiver.Name)

	result, err = revision.CreateReceiver(&createdReceiver)
	if err != nil {
		return nil, err
	}

	err = rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}
		rs.resourcePermissions.SetDefaultPermissions(ctx, orgID, user, createdReceiver.GetUID())
		return rs.setReceiverProvenance(ctx, orgID, &createdReceiver)
	})
	if err != nil {
		return nil, err
	}

	span.AddEvent("Created a new receiver", trace.WithAttributes(
		attribute.String("uid", result.UID),
		attribute.String("version", result.Version),
	))
	rs.log.FromContext(ctx).Info("Created a new receiver", "receiver", result.Name, "uid", result.UID, "fingerprint", result.Version, "integrations", result.GetIntegrationTypes())
	return result, nil
}

func (rs *ReceiverService) UpdateReceiver(ctx context.Context, r *models.Receiver, storedSecureFields map[string][]string, orgID int64, user identity.Requester) (*models.Receiver, error) {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.update", trace.WithAttributes(
		attribute.String("receiver", r.Name),
		attribute.String("uid", r.UID),
		attribute.String("version", r.Version),
		attribute.StringSlice("integrations", r.GetIntegrationTypes()),
	))
	defer span.End()

	if err := rs.authz.AuthorizeUpdate(ctx, user, r); err != nil {
		return nil, err
	}

	logger := rs.log.FromContext(ctx).New("receiver", r.Name, "uid", r.UID, "version", r.Version, "integrations", r.GetIntegrationTypes())
	logger.Debug("Updating receiver")

	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	prov, err := rs.loadProvenances(ctx, orgID)
	if err != nil {
		return nil, err
	}

	existing, err := revision.GetReceiver(r.GetUID(), prov)
	if err != nil {
		return nil, err
	}

	// We re-encrypt the existing receiver to ensure any unencrypted secure fields that are correctly encrypted, note this should NOT re-encrypt secure fields that are already encrypted.
	// This is rare, but can happen if a receiver is created with unencrypted secure fields and then the secure option is added later.
	// Preferably, this would be handled by receiver config versions and migrations but for now this is a good safety net.
	err = existing.Encrypt(rs.encryptor(ctx))
	if err != nil {
		return nil, err
	}

	span.AddEvent("Loaded current receiver", trace.WithAttributes(
		attribute.String("concurrency_token", revision.ConcurrencyToken),
		attribute.String("receiver", existing.Name),
		attribute.String("uid", existing.UID),
		attribute.String("version", existing.Version),
		attribute.StringSlice("integrations", existing.GetIntegrationTypes()),
	))

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

	result, err := revision.UpdateReceiver(&updatedReceiver)
	if err != nil {
		return nil, err
	}

	err = rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		// If the name of the receiver changed, we must update references to it in both routes and notification settings.
		if existing.Name != r.Name {
			err := rs.RenameReceiverInDependentResources(ctx, orgID, revision, existing.Name, r.Name, r.Provenance)
			if err != nil {
				return err
			}
			// Update receiver permissions
			permissionsUpdated, err := rs.resourcePermissions.CopyPermissions(ctx, orgID, user, legacy_storage.NameToUid(existing.Name), legacy_storage.NameToUid(r.Name))
			if err != nil {
				return err
			}
			if permissionsUpdated > 0 {
				logger.Info("Moved custom receiver permissions", "oldName", existing.Name, "count", permissionsUpdated)
			}
			if err := rs.resourcePermissions.DeleteResourcePermissions(ctx, orgID, legacy_storage.NameToUid(existing.Name)); err != nil {
				return err
			}
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

	logger.Info("Updated receiver", "new_version", result.Version)
	return result, nil
}

func (rs *ReceiverService) UsedByRules(ctx context.Context, orgID int64, name string) ([]models.AlertRuleKey, error) {
	keys, err := rs.ruleNotificationsStore.ListNotificationSettings(ctx, models.ListNotificationSettingsQuery{OrgID: orgID, ReceiverName: name})
	if err != nil {
		return nil, err
	}

	return maps.Keys(keys), nil
}

// AccessControlMetadata returns access control metadata for the given Receivers.
func (rs *ReceiverService) AccessControlMetadata(ctx context.Context, user identity.Requester, receivers ...*models.Receiver) (map[string]models.ReceiverPermissionSet, error) {
	return rs.authz.Access(ctx, user, receivers...)
}

// InUseMetadata returns metadata for the given Receivers about their usage in routes and rules.
func (rs *ReceiverService) InUseMetadata(ctx context.Context, orgID int64, receivers ...*models.Receiver) (map[string]models.ReceiverMetadata, error) {
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}
	receiverUses := revision.ReceiverUseByName()

	q := models.ListNotificationSettingsQuery{OrgID: orgID}
	if len(receivers) == 1 {
		q.ReceiverName = receivers[0].Name
	}
	keys, err := rs.ruleNotificationsStore.ListNotificationSettings(ctx, q)
	if err != nil {
		return nil, err
	}

	byReceiver := map[string][]models.AlertRuleKey{}
	for key, settings := range keys {
		for _, s := range settings {
			if s.Receiver != "" {
				byReceiver[s.Receiver] = append(byReceiver[s.Receiver], key)
			}
		}
	}

	results := make(map[string]models.ReceiverMetadata, len(receivers))
	for _, rcv := range receivers {
		results[rcv.GetUID()] = models.ReceiverMetadata{
			InUseByRoutes: receiverUses[rcv.Name],
			InUseByRules:  byReceiver[rcv.Name],
			CanUse:        rcv.Origin == models.ResourceOriginGrafana, // Only receivers from the Grafana configuration can be used.
		}
	}

	return results, nil
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
		if err := rs.provisioningStore.SetProvenance(ctx, integration, orgID, receiver.Provenance); err != nil { // TODO: Should we set ProvenanceNone?
			return err
		}
	}
	return nil
}

func (rs *ReceiverService) deleteProvenances(ctx context.Context, orgID int64, integrations []*models.Integration) error {
	// Delete provenance for all integrations.
	for _, integration := range integrations {
		if err := rs.provisioningStore.DeleteProvenance(ctx, integration, orgID); err != nil {
			return err
		}
	}
	return nil
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

func makeErrReceiverDependentResourcesProvenance(usedByRoutes bool, rules []models.AlertRuleKey) error {
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

	return ErrReceiverDependentResourcesProvenance.Build(errutil.TemplateData{
		Public: data,
	})
}

func (rs *ReceiverService) RenameReceiverInDependentResources(ctx context.Context, orgID int64, revision *legacy_storage.ConfigRevision, oldName, newName string, receiverProvenance models.Provenance) error {
	ctx, span := rs.tracer.Start(ctx, "alerting.receivers.rename-dependent-resources", trace.WithAttributes(
		attribute.String("oldName", oldName),
		attribute.String("newName", newName),
		attribute.String("receiver_provenance", string(receiverProvenance)),
	))
	defer span.End()

	validate := validation.ValidateProvenanceOfDependentResources(receiverProvenance)
	// if there are no references to the old time interval, exit
	updatedRoutes := revision.RenameReceiverInRoutes(oldName, newName)
	canUpdate := true
	if updatedRoutes > 0 {
		routeProvenance, err := rs.provisioningStore.GetProvenance(ctx, revision.Config.AlertmanagerConfig.Route, orgID)
		if err != nil {
			return err
		}
		canUpdate = validate(routeProvenance)
	}
	dryRun := !canUpdate
	affected, invalidProvenance, err := rs.ruleNotificationsStore.RenameReceiverInNotificationSettings(ctx, orgID, oldName, newName, validate, dryRun)
	if err != nil {
		return err
	}
	if !canUpdate || len(invalidProvenance) > 0 {
		err := makeErrReceiverDependentResourcesProvenance(updatedRoutes > 0, invalidProvenance)
		span.RecordError(err, trace.WithAttributes(
			attribute.Bool("invalid_route_provenance", canUpdate),
			attribute.Int("invalid_rule_provenances", len(invalidProvenance)),
		))
		return err
	}
	if len(affected) > 0 || updatedRoutes > 0 {
		rs.log.FromContext(ctx).Info("Updated rules and routes that use renamed receiver", "oldName", oldName, "newName", newName, "rules", len(affected), "routes", updatedRoutes)
	}
	return nil
}
