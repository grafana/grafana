package notifier

import (
	"context"
	"encoding/base64"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

// ReceiverService is the service for managing alertmanager receivers.
type ReceiverService struct {
	ac                accesscontrol.AccessControl
	receiverStore     receiverStore
	encryptionService secrets.Service
	log               log.Logger
}

type receiverStore interface {
	GetReceiver(ctx context.Context, orgID int64, uid string) (*models.Receiver, error)
	GetReceivers(ctx context.Context, orgID int64, uids ...string) ([]*models.Receiver, error)
	DeleteReceiver(ctx context.Context, orgID int64, uid string, callerProvenance models.Provenance, version string) error
}

func NewReceiverService(
	ac accesscontrol.AccessControl,
	receiverStore receiverStore,
	encryptionService secrets.Service,
	log log.Logger,
) *ReceiverService {
	return &ReceiverService{
		ac:                ac,
		encryptionService: encryptionService,
		log:               log,
		receiverStore:     receiverStore,
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

	rcv, err := rs.receiverStore.GetReceiver(ctx, q.OrgID, models.GetUID(q.Name))
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}

	decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
	if err != nil {
		return definitions.GettableApiReceiver{}, err
	}
	decryptFn := rs.decryptOrRedact(ctx, decrypt, q.Name, "")

	return ReceiverToGettable(rcv, decryptFn, false)
}

// GetReceivers returns a list of receivers a user has access to.
// Receivers can be filtered by name, and secure settings are decrypted if requested and the user has access to do so.
func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) {
	if q.Decrypt && user == nil {
		return nil, ac.NewAuthorizationErrorWithPermissions("read any decrypted receiver", nil) // TODO: Replace with authz service.
	}

	uids := make([]string, 0, len(q.Names))
	for _, name := range q.Names {
		uids = append(uids, models.GetUID(name))
	}

	receivers, err := rs.receiverStore.GetReceivers(ctx, q.OrgID, uids...)
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
	for i := q.Offset; i < len(receivers); i++ {
		r := receivers[i]

		decrypt, err := rs.shouldDecrypt(ctx, user, q.Decrypt)
		if err != nil {
			return nil, err
		}

		decryptFn := rs.decryptOrRedact(ctx, decrypt, r.Name, "")

		// Only has permission to list. This reduces from:
		// - Has List permission
		// - Doesn't have ReadRedacted (or ReadDecrypted permission since it's a subset).
		listOnly := !readRedactedAccess

		res, err := ReceiverToGettable(r, decryptFn, listOnly)
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
	return rs.receiverStore.DeleteReceiver(ctx, orgID, uid, models.Provenance(callerProvenance), version)
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
