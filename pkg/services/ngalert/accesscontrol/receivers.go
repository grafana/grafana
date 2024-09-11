package accesscontrol

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	// Asserts pre-conditions for read access to redacted receivers. If this evaluates to false, the user cannot read any redacted receivers.
	readRedactedReceiversPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsRead), // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingReceiversRead),     // Action for redacted receivers. UID scope.
		readDecryptedReceiversPreConditionsEval,
	)
	// Asserts pre-conditions for read access to decrypted receivers. If this evaluates to false, the user cannot read any decrypted receivers.
	readDecryptedReceiversPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets), // Action for decrypted receivers. UID scope.
	)

	// Asserts read-only access to all redacted receivers.
	readRedactedAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsRead),

		// TODO: The following should be scoped, but are currently interpreted as global. Needs a db migration when scope is added.
		ac.EvalPermission(ac.ActionAlertingReceiversRead), // TODO: Add global scope with fgac.
		readDecryptedAllReceiversEval,
	)
	// Asserts read-only access to all decrypted receivers.
	readDecryptedAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets), // TODO: Add global scope with fgac.
	)

	// Asserts read-only access to a specific redacted receiver.
	readRedactedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),

			// TODO: The following should be scoped, but are currently interpreted as global. Needs a db migration when scope is added.
			ac.EvalPermission(ac.ActionAlertingReceiversRead), // TODO: Add uid scope with fgac.
			readDecryptedReceiverEval(uid),
		)
	}

	// Asserts read-only access to a specific decrypted receiver.
	readDecryptedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets), // TODO: Add uid scope with fgac.
		)
	}

	// Asserts read-only access to list redacted receivers. // TODO: Remove this with fgac.
	readRedactedReceiversListEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversList),
	)

	// Extra permissions that give read-only access to all redacted receivers when called from provisioning api.
	provisioningExtraReadRedactedPermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningRead),              // Global provisioning action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingNotificationsProvisioningRead), // Global provisioning action for receivers. Org scope.
		provisioningExtraReadDecryptedPermissions,
	)

	// Extra permissions that give read-only access to all decrypted receivers when called from provisioning api.
	provisioningExtraReadDecryptedPermissions = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingProvisioningReadSecrets), // Global provisioning action for all AM config + secrets. Org scope.
	)
)

type ReceiverAccess[T models.Identified] struct {
	read          actionAccess[T]
	readDecrypted actionAccess[T]
}

// NewReceiverAccess creates a new ReceiverAccess service. If includeProvisioningActions is true, the service will include
// permissions specific to the provisioning API.
func NewReceiverAccess[T models.Identified](a ac.AccessControl, includeProvisioningActions bool) *ReceiverAccess[T] {
	rcvAccess := &ReceiverAccess[T]{
		read: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "read",
			authorizeSome: readRedactedReceiversPreConditionsEval,
			authorizeOne: func(receiver T) ac.Evaluator {
				return readRedactedReceiverEval(receiver.GetUID())
			},
			authorizeAll: readRedactedAllReceiversEval,
		},
		readDecrypted: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "decrypted receiver",
			action:        "read",
			authorizeSome: readDecryptedReceiversPreConditionsEval,
			authorizeOne: func(receiver T) ac.Evaluator {
				return readDecryptedReceiverEval(receiver.GetUID())
			},
			authorizeAll: readDecryptedAllReceiversEval,
		},
	}

	// If this service is meant for the provisioning API, we include the provisioning actions as possible permissions.
	if includeProvisioningActions {
		rcvAccess.read.authorizeSome = ac.EvalAny(provisioningExtraReadRedactedPermissions, rcvAccess.read.authorizeSome)
		rcvAccess.readDecrypted.authorizeSome = ac.EvalAny(provisioningExtraReadDecryptedPermissions, rcvAccess.readDecrypted.authorizeSome)

		rcvAccess.read.authorizeOne = func(receiver T) ac.Evaluator {
			return ac.EvalAny(provisioningExtraReadRedactedPermissions, rcvAccess.read.authorizeOne(receiver))
		}
		rcvAccess.readDecrypted.authorizeOne = func(receiver T) ac.Evaluator {
			return ac.EvalAny(provisioningExtraReadDecryptedPermissions, rcvAccess.readDecrypted.authorizeOne(receiver))
		}

		rcvAccess.read.authorizeAll = ac.EvalAny(provisioningExtraReadRedactedPermissions, rcvAccess.read.authorizeAll)
		rcvAccess.readDecrypted.authorizeAll = ac.EvalAny(provisioningExtraReadDecryptedPermissions, rcvAccess.readDecrypted.authorizeAll)
	}

	return rcvAccess
}

// HasList checks if user has access to list redacted receivers. Returns false if user does not have access.
func (s ReceiverAccess[T]) HasList(ctx context.Context, user identity.Requester) (bool, error) { // TODO: Remove this with fgac.
	return s.read.HasAccess(ctx, user, readRedactedReceiversListEval)
}

// FilterRead filters the given list of receivers based on the read redacted access control permissions of the user.
// This method is preferred when many receivers need to be checked.
func (s ReceiverAccess[T]) FilterRead(ctx context.Context, user identity.Requester, receivers ...T) ([]T, error) {
	return s.read.Filter(ctx, user, receivers...)
}

// AuthorizeRead checks if user has access to read a redacted receiver. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeRead(ctx context.Context, user identity.Requester, receiver T) error {
	return s.read.Authorize(ctx, user, receiver)
}

// HasRead checks if user has access to read a redacted receiver. Returns false if user does not have access.
func (s ReceiverAccess[T]) HasRead(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	return s.read.Has(ctx, user, receiver)
}

// HasReadAll checks if user has access to read all redacted receivers. Returns false if user does not have access.
func (s ReceiverAccess[T]) HasReadAll(ctx context.Context, user identity.Requester) (bool, error) { // TODO: Temporary for legacy compatibility.
	return s.read.HasAccess(ctx, user, s.read.authorizeAll)
}

// FilterReadDecrypted filters the given list of receivers based on the read decrypted access control permissions of the user.
// This method is preferred when many receivers need to be checked.
func (s ReceiverAccess[T]) FilterReadDecrypted(ctx context.Context, user identity.Requester, receivers ...T) ([]T, error) {
	return s.readDecrypted.Filter(ctx, user, receivers...)
}

// AuthorizeReadDecrypted checks if user has access to read a decrypted receiver.
func (s ReceiverAccess[T]) AuthorizeReadDecrypted(ctx context.Context, user identity.Requester, receiver T) error {
	return s.readDecrypted.Authorize(ctx, user, receiver)
}

// HasReadDecrypted checks if user has access to read a decrypted receiver. Returns false if user does not have access.
func (s ReceiverAccess[T]) HasReadDecrypted(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	return s.readDecrypted.Has(ctx, user, receiver)
}

// AuthorizeReadDecryptedAll checks if user has access to read all decrypted receiver. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeReadDecryptedAll(ctx context.Context, user identity.Requester) error { // TODO: Temporary for legacy compatibility.
	return s.readDecrypted.HasAccessOrError(ctx, user, s.readDecrypted.authorizeAll, func() string {
		return fmt.Sprintf("%s %s", s.readDecrypted.action, s.readDecrypted.resource)
	})
}
