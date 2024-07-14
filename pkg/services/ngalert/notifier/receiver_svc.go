package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	// ErrPermissionDenied is returned when the user does not have permission to perform the requested action.
	ErrPermissionDenied = errors.New("permission denied") // TODO: convert to errutil
	// ErrNotFound is returned when the requested resource does not exist.
	ErrNotFound = errors.New("not found") // TODO: convert to errutil
)

// ReceiverService is the service for managing alertmanager receivers.
type ReceiverService struct {
	ac                accesscontrol.AccessControl
	provisioningStore provisoningStore
	cfgStore          configStore
	encryptionService secrets.Service
	xact              transactionManager
	log               log.Logger
}

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
}

type provisoningStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
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

	provenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, "contactPoint")
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

	provenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, "contactPoint")
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
