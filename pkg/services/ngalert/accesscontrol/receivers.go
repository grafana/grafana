package accesscontrol

import (
	"context"

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
		ac.EvalPermission(ac.ActionAlertingReceiversRead, models.ScopeReceiversAll),
		readDecryptedAllReceiversEval,
	)
	// Asserts read-only access to all decrypted receivers.
	readDecryptedAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets, models.ScopeReceiversAll),
	)

	// Asserts read-only access to a specific redacted receiver.
	readRedactedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsRead),
			ac.EvalPermission(ac.ActionAlertingReceiversRead, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
			readDecryptedReceiverEval(uid),
		)
	}

	// Asserts read-only access to a specific decrypted receiver.
	readDecryptedReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingReceiversReadSecrets, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
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
		ac.EvalPermission(ac.ActionAlertingReceiversUpdate, models.ScopeReceiversAll),
	)

	// Asserts update access to a specific receiver.
	updateReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingReceiversUpdate, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}

	// Asserts pre-conditions for access to modify protected fields of receivers. If this evaluates to false, the user cannot modify protected fields of any receivers.
	updateReceiversProtectedPreConditionsEval = ac.EvalAll(
		updateReceiversPreConditionsEval,
		ac.EvalPermission(ac.ActionAlertingReceiversUpdateProtected), // Action for receivers. UID scope.
	)

	// Asserts access to modify protected fields of a specific receiver.
	updateReceiverProtectedEval = func(uid string) ac.Evaluator {
		return ac.EvalAll(
			updateReceiverEval(uid),
			ac.EvalPermission(ac.ActionAlertingReceiversUpdateProtected, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}

	// Asserts access to modify protected fields of all receivers.
	updateAllReceiverProtectedEval = ac.EvalAll(
		updateAllReceiversEval,
		ac.EvalPermission(ac.ActionAlertingReceiversUpdateProtected, models.ScopeReceiversAll),
	)

	// Delete

	// Asserts pre-conditions for delete access to receivers. If this evaluates to false, the user cannot delete any receivers.
	deleteReceiversPreConditionsEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite), // Global action for all AM config. Org scope.
		ac.EvalPermission(ac.ActionAlertingReceiversDelete),    // Action for receivers. UID scope.
	)

	// Asserts delete access to all receivers.
	deleteAllReceiversEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(ac.ActionAlertingReceiversDelete, models.ScopeReceiversAll),
	)

	// Asserts delete access to a specific receiver.
	deleteReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingReceiversDelete, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
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
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsRead, models.ScopeReceiversAll),
		ac.EvalPermission(ac.ActionAlertingReceiversPermissionsWrite, models.ScopeReceiversAll),
	)

	// Asserts resource permissions access to a specific receiver.
	permissionsReceiverEval = func(uid string) ac.Evaluator {
		return ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingReceiversPermissionsRead, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
			ac.EvalPermission(ac.ActionAlertingReceiversPermissionsWrite, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
		)
	}

	testReceiversAllEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(ac.ActionAlertingReceiversTest),
		ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingReceiversTestCreate, models.ScopeReceiversAll),
			readRedactedAllReceiversEval,
			updateAllReceiversEval,
		),
	)

	TestReceiversPreconditionEval = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalPermission(ac.ActionAlertingReceiversTest),
		ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingReceiversTestCreate),
			readRedactedReceiversPreConditionsEval,
			updateReceiversPreConditionsEval,
		),
	)

	testReceiversEvalOne = func(uid string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
			ac.EvalPermission(ac.ActionAlertingReceiversTest),
			ac.EvalAll(
				readRedactedReceiverEval(uid),
				updateReceiverEval(uid),
				ac.EvalPermission(ac.ActionAlertingReceiversTestCreate, models.ScopeReceiversProvider.GetResourceScopeUID(uid)),
			),
		)
	}

	// It's a new receiver, we do not need to check for read because the user will get admin permissions once it's created
	TestReceiverNew = ac.EvalAny(
		ac.EvalPermission(ac.ActionAlertingReceiversTest),
		ac.EvalPermission(ac.ActionAlertingNotificationsWrite),
		ac.EvalAll(
			ac.EvalPermission(ac.ActionAlertingReceiversCreate), // Action for receivers. Org scope.
			ac.EvalPermission(ac.ActionAlertingReceiversTestCreate, models.ScopeReceiversProvider.GetNewResourceScope()),
		),
	)
)

type ReceiverAccess[T models.Identified] struct {
	read            actionAccess[T]
	readDecrypted   actionAccess[T]
	create          actionAccess[T]
	update          actionAccess[T]
	updateProtected actionAccess[T]
	delete          actionAccess[T]
	permissions     actionAccess[T]
	test            actionAccess[T]
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
		updateProtected: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "update protected fields of", // this produces message "user is not authorized to update protected fields of X receiver"
			authorizeSome: updateReceiversProtectedPreConditionsEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return updateReceiverProtectedEval(receiver.GetUID())
			},
			authorizeAll: updateAllReceiverProtectedEval,
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
		test: actionAccess[T]{
			genericService: genericService{
				ac: a,
			},
			resource:      "receiver",
			action:        "test",
			authorizeSome: TestReceiversPreconditionEval,
			authorizeOne: func(receiver models.Identified) ac.Evaluator {
				return testReceiversEvalOne(receiver.GetUID())
			},
			authorizeAll: testReceiversAllEval,
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

func (s ReceiverAccess[T]) HasUpdateProtected(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	return s.updateProtected.Has(ctx, user, receiver)
}

func (s ReceiverAccess[T]) AuthorizeUpdateProtected(ctx context.Context, user identity.Requester, receiver T) error {
	return s.updateProtected.Authorize(ctx, user, receiver)
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

func (s ReceiverAccess[T]) AuthorizeTestAll(ctx context.Context, user identity.Requester) error {
	return s.test.AuthorizeAll(ctx, user)
}

// AuthorizeTest authorizes the user to perform the test action on a receiver resource. Returns an error if unauthorized.
func (s ReceiverAccess[T]) AuthorizeTest(ctx context.Context, user identity.Requester, identified T) error {
	return s.test.Authorize(ctx, user, identified)
}

// AuthorizeTestByUID authorizes the user to perform the test action on a receiver resource by UID. Returns an error if unauthorized.
func (s ReceiverAccess[T]) AuthorizeTestByUID(ctx context.Context, user identity.Requester, uid string) error {
	return s.test.Authorize(ctx, user, identified{uid: uid})
}

// AuthorizeTestNew authorizes the user to perform the test action on a new receiver resource. Returns an error if unauthorized.
func (s ReceiverAccess[T]) AuthorizeTestNew(ctx context.Context, user identity.Requester) error {
	// skip shortcuts that check preconditions and wildcards
	authz := actionAccess[identified]{
		genericService: s.test.genericService,
		resource:       "receiver",
		action:         "test new",
		authorizeOne: func(receiver models.Identified) ac.Evaluator {
			return TestReceiverNew
		},
	}
	return authz.authorize(ctx, user, identified{})
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

	if err := s.updateProtected.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionModifyProtected, false)
	} else if err := s.updateProtected.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionModifyProtected, true)
	}

	if err := s.test.AuthorizePreConditions(ctx, user); err != nil {
		basePerms.Set(models.ReceiverPermissionTest, false)
	} else if err := s.test.AuthorizeAll(ctx, user); err == nil {
		basePerms.Set(models.ReceiverPermissionTest, true)
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

		if _, ok := permSet.Has(models.ReceiverPermissionModifyProtected); !ok {
			err := s.updateProtected.authorize(ctx, user, rcv)
			permSet.Set(models.ReceiverPermissionModifyProtected, err == nil)
		}

		if _, ok := permSet.Has(models.ReceiverPermissionTest); !ok {
			err := s.test.authorize(ctx, user, rcv)
			permSet.Set(models.ReceiverPermissionTest, err == nil)
		}

		result[rcv.GetUID()] = permSet
	}
	return result, nil
}
