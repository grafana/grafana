package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	ScopeReceiversRoot = "receivers"
)

var (
	ScopeReceiversProvider = ac.NewScopeProvider(ScopeReceiversRoot)
	ScopeReceiversAll      = ScopeReceiversProvider.GetResourceAllScope()
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
		ac.EvalPermission(ac.ActionAlertingReceiversRead, ScopeReceiversAll),
		readDecryptedAllReceiversEval,
	)
	// Asserts read-only access to all decrypted receivers.
	readDecryptedAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets, ScopeReceiversAll),
	)

	// Asserts read-only access to a specific redacted receiver.
	readRedactedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingReceiversRead, ScopeReceiversProvider.GetResourceScopeUID(uid)),
			readDecryptedReceiverEval(uid),
		)
	}

	// Asserts read-only access to a specific decrypted receiver.
	readDecryptedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets, ScopeReceiversProvider.GetResourceScopeUID(uid)),
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

	// Create

	// Asserts pre-conditions for create access to receivers. If this evaluates to false, the user cannot create any receivers.
	// Create has no scope, so these permissions are both necessary and sufficient to create any and all receivers.
	createReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite), // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingReceiversCreate),    // Action for receivers. Org scope.
	)

	// Update

	// Asserts pre-conditions for update access to receivers. If this evaluates to false, the user cannot update any receivers.
	updateReceiversPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite), // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingReceiversUpdate),    // Action for receivers. UID scope.
	)

	// Asserts update access to all receivers.
	updateAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(ac.ActionAlertingReceiversUpdate, ScopeReceiversAll),
	)

	// Asserts update access to a specific receiver.
	updateReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingReceiversUpdate, ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}

	// Delete

	// Asserts pre-conditions for delete access to receivers. If this evaluates to false, the user cannot delete any receivers.
	deleteReceiversPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite), // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingReceiversDelete),    // Action for receivers. UID scope.
	)

	// Asserts delete access to all receivers.
	deleteAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(ac.ActionAlertingReceiversDelete, ScopeReceiversAll),
	)

	// Asserts delete access to a specific receiver.
	deleteReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingReceiversDelete, ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}
)

type ReceiverAccess[T models.Identified] struct {
	read          actionAccess[T]
	readDecrypted actionAccess[T]
	create        actionAccess[T]
	update        actionAccess[T]
	delete        actionAccess[models.Identified]
}

// NewReceiverAccess creates a new ReceiverAccess service. If includeProvisioningActions is true, the service will include
// permissions specific to the provisioning API.
func NewReceiverAccess[T models.Identified](a ac.AccessControl, includeProvisioningActions bool) *ReceiverAccess[T] {
	// If this service is meant for the provisioning API, we include the provisioning actions as possible permissions.
	// TODO: Improve this monkey patching.
	readRedactedReceiversPreConditionsEval := readRedactedReceiversPreConditionsEval
	readDecryptedReceiversPreConditionsEval := readDecryptedReceiversPreConditionsEval
	readRedactedReceiverEval := readRedactedReceiverEval
	readDecryptedReceiverEval := readDecryptedReceiverEval
	readRedactedAllReceiversEval := readRedactedAllReceiversEval
	readDecryptedAllReceiversEval := readDecryptedAllReceiversEval
	if includeProvisioningActions {
		readRedactedReceiversPreConditionsEval = ac.EvalAny(provisioningExtraReadRedactedPermissions, readRedactedReceiversPreConditionsEval)
		readDecryptedReceiversPreConditionsEval = ac.EvalAny(provisioningExtraReadDecryptedPermissions, readDecryptedReceiversPreConditionsEval)

		readRedactedReceiverEval = func(uid string) ac.Evaluator {
			return ac.EvalAny(provisioningExtraReadRedactedPermissions, readRedactedReceiverEval(uid))
		}
		readDecryptedReceiverEval = func(uid string) ac.Evaluator {
			return ac.EvalAny(provisioningExtraReadDecryptedPermissions, readDecryptedReceiverEval(uid))
		}

		readRedactedAllReceiversEval = ac.EvalAny(provisioningExtraReadRedactedPermissions, readRedactedAllReceiversEval)
		readDecryptedAllReceiversEval = ac.EvalAny(provisioningExtraReadDecryptedPermissions, readDecryptedAllReceiversEval)
	}

	rcvAccess := &ReceiverAccess[T]{
		read: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "read",
			authorizeSome: readRedactedReceiversPreConditionsEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
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
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return readDecryptedReceiverEval(receiver.GetUID())
			},
			authorizeAll: readDecryptedAllReceiversEval,
		},
		create: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "create",
			authorizeSome: ac.EvalAll(readRedactedReceiversPreConditionsEval, createReceiversEval),
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return ac.EvalAll(readRedactedReceiversPreConditionsEval, createReceiversEval)
			},
			authorizeAll: ac.EvalAll(readRedactedReceiversPreConditionsEval, createReceiversEval),
		},
		update: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "update",
			authorizeSome: ac.EvalAll(readRedactedReceiversPreConditionsEval, updateReceiversPreConditionsEval),
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return ac.EvalAll(readRedactedReceiverEval(receiver.GetUID()), updateReceiverEval(receiver.GetUID()))
			},
			authorizeAll: ac.EvalAll(readRedactedAllReceiversEval, updateAllReceiversEval),
		},
		delete: actionAccess[models.Identified]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "delete",
			authorizeSome: ac.EvalAll(readRedactedReceiversPreConditionsEval, deleteReceiversPreConditionsEval),
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return ac.EvalAll(readRedactedReceiverEval(receiver.GetUID()), deleteReceiverEval(receiver.GetUID()))
			},
			authorizeAll: ac.EvalAll(readRedactedAllReceiversEval, deleteAllReceiversEval),
		},
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

// AuthorizeUpdate checks if user has access to update a receiver. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeUpdate(ctx context.Context, user identity.Requester, receiver T) error {
	return s.update.Authorize(ctx, user, receiver)
}

// Global

// AuthorizeCreate checks if user has access to create receivers. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	return s.create.AuthorizeAll(ctx, user)
}

// By UID

type identified struct {
	uid string
}

func (i identified) GetUID() string {
	return i.uid
}

// AuthorizeDeleteByUID checks if user has access to delete a receiver by uid. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.delete.Authorize(ctx, user, identified{uid: uid})
}

// AuthorizeReadByUID checks if user has access to read a redacted receiver by uid. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.read.Authorize(ctx, user, identified{uid: uid})
}

// AuthorizeUpdateByUID checks if user has access to update a receiver by uid. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.update.Authorize(ctx, user, identified{uid: uid})
}

// Preconditions

// AuthorizeReadSome checks if user has access to read some redacted receivers. Returns an error if user does not have access.
func (s ReceiverAccess[T]) AuthorizeReadSome(ctx context.Context, user identity.Requester) error {
	return s.read.AuthorizePreConditions(ctx, user)
}
