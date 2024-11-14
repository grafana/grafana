package accesscontrol

import (
	"context"
	// #nosec G505 Used only for shortening the uid, not for security purposes.
	"crypto/sha1"
	"encoding/hex"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

const (
	ScopeReceiversRoot = "receivers"
)

var (
	ScopeReceiversProvider = ReceiverScopeProvider{ac.NewScopeProvider(ScopeReceiversRoot)}
	ScopeReceiversAll      = ScopeReceiversProvider.GetResourceAllScope()
)

type ReceiverScopeProvider struct {
	ac.ScopeProvider
}

func (p ReceiverScopeProvider) GetResourceScopeUID(uid string) string {
	return ScopeReceiversProvider.ScopeProvider.GetResourceScopeUID(p.GetResourceIDFromUID(uid))
}

// GetResourceIDFromUID converts a receiver uid to a resource id. This is necessary as resource ids are limited to 40 characters.
// If the uid is already less than or equal to 40 characters, it is returned as is.
func (p ReceiverScopeProvider) GetResourceIDFromUID(uid string) string {
	if len(uid) <= util.MaxUIDLength {
		return uid
	}
	// #nosec G505 Used only for shortening the uid, not for security purposes.
	h := sha1.New()
	h.Write([]byte(uid))
	return hex.EncodeToString(h.Sum(nil))
}

// ReceiverPermission is a type for representing a receiver permission.
type ReceiverPermission string

const (
	ReceiverPermissionView  ReceiverPermission = "View"
	ReceiverPermissionEdit  ReceiverPermission = "Edit"
	ReceiverPermissionAdmin ReceiverPermission = "Admin"
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

	// Admin

	// Asserts pre-conditions for resource permissions access to receivers. If this evaluates to false, the user cannot modify permissions for any receivers.
	permissionsReceiversPreConditionsEval = ac.EvalAll(
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsRead),  // Action for receivers. UID scope.
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsWrite), // Action for receivers. UID scope.
	)

	// Asserts resource permissions access to all receivers.
	permissionsAllReceiversEval = ac.EvalAll(
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsRead, ScopeReceiversAll),
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsWrite, ScopeReceiversAll),
	)

	// Asserts resource permissions access to a specific receiver.
	permissionsReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingReceiversPermissionsRead, ScopeReceiversProvider.GetResourceScopeUID(uid)),
			ac.EvalPermission(ac.ActionAlertingReceiversPermissionsWrite, ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}
)

type ReceiverAccess[T models.Identified] struct {
	read          actionAccess[T]
	readDecrypted actionAccess[T]
	create        actionAccess[T]
	update        actionAccess[T]
	delete        actionAccess[T]
	permissions   actionAccess[T]
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
			authorizeSome: createReceiversEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return createReceiversEval
			},
			authorizeAll: createReceiversEval,
		},
		update: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "update",
			authorizeSome: updateReceiversPreConditionsEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return updateReceiverEval(receiver.GetUID())
			},
			authorizeAll: updateAllReceiversEval,
		},
		delete: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "delete",
			authorizeSome: deleteReceiversPreConditionsEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return deleteReceiverEval(receiver.GetUID())
			},
			authorizeAll: deleteAllReceiversEval,
		},
		permissions: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "admin", // Essentially read+write receiver resource permissions.
			authorizeSome: permissionsReceiversPreConditionsEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return permissionsReceiverEval(receiver.GetUID())
			},
			authorizeAll: permissionsAllReceiversEval,
		},
	}

	// If this service is meant for the provisioning API, we include the provisioning actions as possible permissions.
	if includeProvisioningActions {
		extendAccessControl(&rcvAccess.read, ac.EvalAny, actionAccess[T]{
			authorizeSome: provisioningExtraReadRedactedPermissions,
			authorizeAll:  provisioningExtraReadRedactedPermissions,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return provisioningExtraReadRedactedPermissions
			},
		})
		extendAccessControl(&rcvAccess.readDecrypted, ac.EvalAny, actionAccess[T]{
			authorizeSome: provisioningExtraReadDecryptedPermissions,
			authorizeAll:  provisioningExtraReadDecryptedPermissions,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return provisioningExtraReadDecryptedPermissions
			},
		})
	}

	// Write, delete, and permissions management should require read permissions.
	extendAccessControl(&rcvAccess.update, ac.EvalAll, rcvAccess.read)
	extendAccessControl(&rcvAccess.delete, ac.EvalAll, rcvAccess.read)
	extendAccessControl(&rcvAccess.permissions, ac.EvalAll, rcvAccess.read)

	return rcvAccess
}

// extendAccessControl extends the access control of base with the extension. The operator function is used to combine
// the authorization evaluators.
func extendAccessControl[T models.Identified](base *actionAccess[T], operator func(evaluator ...ac.Evaluator) ac.Evaluator, extension actionAccess[T]) {
	// Prevent infinite recursion.
	baseSome := base.authorizeSome
	baseAll := base.authorizeAll
	baseOne := base.authorizeOne

	// Extend the access control of base with the extension.
	base.authorizeSome = operator(extension.authorizeSome, baseSome)
	base.authorizeAll = operator(extension.authorizeAll, baseAll)
	base.authorizeOne = func(resource models.Identified) ac.Evaluator {
		return operator(extension.authorizeOne(resource), baseOne(resource))
	}
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

// All access permissions for a given receiver.

// Access returns the permission sets for a slice of receivers. The permission set includes secrets, write, and
// delete which corresponds the given user being able to read, write, and delete each given receiver.
func (s ReceiverAccess[T]) Access(ctx context.Context, user identity.Requester, receivers ...T) (map[string]models.ReceiverPermissionSet, error) {
	basePerms := models.NewReceiverPermissionSet()
	if err := s.readDecrypted.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionReadSecret, false) // Doesn't match the preconditions.
	} else if err := s.readDecrypted.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionReadSecret, true) // Has access to all receivers.
	}

	if err := s.permissions.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionAdmin, false) // Doesn't match the preconditions.
	} else if err := s.permissions.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionAdmin, true) // Has access to all receivers.
	}

	if err := s.update.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionWrite, false) // Doesn't match the preconditions.
	} else if err := s.update.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionWrite, true) // Has access to all receivers.
	}

	if err := s.delete.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionDelete, false) // Doesn't match the preconditions.
	} else if err := s.delete.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionDelete, true) // Has access to all receivers.
	}

	if basePerms.AllSet() {
		// Shortcut for the case when all permissions are known based on preconditions.
		result := make(map[string]models.ReceiverPermissionSet, len(receivers))
		for _, rcv := range receivers {
			result[rcv.GetUID()] = basePerms.Clone()
		}
		return result, nil
	}

	result := make(map[string]models.ReceiverPermissionSet, len(receivers))
	for _, rcv := range receivers {
		permSet := basePerms.Clone()
		if _, ok := permSet.Has(models.ReceiverPermissionReadSecret); !ok {
			err := s.readDecrypted.authorize(ctx, user, rcv) // Check permissions ignoring preconditions and all access.
			permSet.Set(models.ReceiverPermissionReadSecret, err == nil)
		}

		if _, ok := permSet.Has(models.ReceiverPermissionAdmin); !ok {
			err := s.permissions.authorize(ctx, user, rcv)
			permSet.Set(models.ReceiverPermissionAdmin, err == nil)
		}

		if _, ok := permSet.Has(models.ReceiverPermissionWrite); !ok {
			err := s.update.authorize(ctx, user, rcv)
			permSet.Set(models.ReceiverPermissionWrite, err == nil)
		}

		if _, ok := permSet.Has(models.ReceiverPermissionDelete); !ok {
			err := s.delete.authorize(ctx, user, rcv)
			permSet.Set(models.ReceiverPermissionDelete, err == nil)
		}

		result[rcv.GetUID()] = permSet
	}
	return result, nil
}
