package accesscontrol

import (
	"context"
	"fmt"

	"golang.org/x/exp/maps"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	instancesRead   = ac.ActionAlertingInstanceRead
	instancesCreate = ac.ActionAlertingInstanceCreate
	instancesWrite  = ac.ActionAlertingInstanceUpdate
	silenceRead     = ac.ActionAlertingSilencesRead
	silenceCreate   = ac.ActionAlertingSilencesCreate
	silenceWrite    = ac.ActionAlertingSilencesWrite
)

var (
	// asserts full read-only access to silences
	readAllSilencesEvaluator = ac.EvalAny(ac.EvalPermission(instancesRead), ac.EvalPermission(silenceRead, dashboards.ScopeFoldersProvider.GetResourceAllScope()))
	// shortcut assertion that to check if user can read silences
	readSomeSilenceEvaluator = ac.EvalAny(ac.EvalPermission(instancesRead), ac.EvalPermission(silenceRead))
	// asserts whether user has read access to rules in a specific folder
	readRuleSilenceEvaluator = func(folderUID string) ac.Evaluator {
		return ac.EvalAny(
			ac.EvalPermission(instancesRead),
			ac.EvalPermission(silenceRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)),
		)
	}

	// shortcut assertion to check if user can create any silence
	createAnySilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesCreate), readAllSilencesEvaluator)
	// asserts that user has access to create general silences, the ones that can match alerts created by one or many rules
	createGeneralSilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesCreate), readSomeSilenceEvaluator)
	// shortcut assertion to check if user can create silences at all
	createSomeRuleSilenceEvaluator = ac.EvalAll(
		readSomeSilenceEvaluator,
		ac.EvalAny(
			ac.EvalPermission(instancesCreate),
			ac.EvalPermission(silenceCreate)),
	)
	// asserts that user has access to create silences in a specific folder
	createRuleSilenceEvaluator = func(uid string) ac.Evaluator {
		return ac.EvalAll(
			ac.EvalAny(
				ac.EvalPermission(instancesCreate),
				ac.EvalPermission(silenceCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid)),
			),
			readRuleSilenceEvaluator(uid),
		)
	}

	// shortcut assertion to check if user can update any silence
	updateAnySilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesWrite), readAllSilencesEvaluator)
	// asserts that user has access to update general silences
	updateGeneralSilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesWrite), readSomeSilenceEvaluator)
	// asserts that user has access to update silences at all
	updateSomeRuleSilenceEvaluator = ac.EvalAll(
		readSomeSilenceEvaluator,
		ac.EvalAny(
			ac.EvalPermission(instancesWrite),
			ac.EvalPermission(silenceWrite)),
	)
	// asserts that user has access to create silences in a specific folder
	updateRuleSilenceEvaluator = func(uid string) ac.Evaluator {
		return ac.EvalAll(
			ac.EvalAny(
				ac.EvalPermission(instancesWrite),
				ac.EvalPermission(silenceWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(uid)),
			),
			readRuleSilenceEvaluator(uid),
		)
	}
)

type RuleUIDToNamespaceStore interface {
	GetNamespacesByRuleUID(ctx context.Context, orgID int64, uids ...string) (map[string]string, error)
}

type SilenceService struct {
	genericService
	store RuleUIDToNamespaceStore
}

func NewSilenceService(ac ac.AccessControl, store RuleUIDToNamespaceStore) *SilenceService {
	return &SilenceService{
		genericService: genericService{
			ac: ac,
		},
		store: store,
	}
}

// silenceWithFolder is a helper struct that holds a silence and its associated rule and folder UIDs.
type silenceWithFolder struct {
	*models.Silence
	ruleUID   *string
	folderUID string
}

// FilterByAccess filters the given list of silences based on the access control permissions of the user.
// Global silence (one that is not attached to a particular rule) is considered available to all users.
// For silences that are not attached to a rule, are checked against authorization.
// This method is more preferred when many silences need to be checked.
func (s SilenceService) FilterByAccess(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.Silence, error) {
	canAll, err := s.authorizeReadSilencePreConditions(ctx, user)
	if err != nil {
		return nil, err
	}
	if canAll {
		return silences, nil
	}

	silencesWithFolders, err := s.withFolders(ctx, user.GetOrgID(), silences...)
	if err != nil {
		return nil, err
	}

	result := make([]*models.Silence, 0, len(silences))
	namespacesByAccess := make(map[string]bool) // caches results of permissions check for each namespace to avoid repeated checks for the same folder
	for _, silWithFolder := range silencesWithFolders {
		hasAccess, ok := namespacesByAccess[silWithFolder.folderUID]
		if !ok {
			hasAccess = s.authorizeReadSilence(ctx, user, silWithFolder) == nil

			// Cache non-empty namespaces to avoid repeated checks for the same folder.
			if silWithFolder.folderUID != "" {
				namespacesByAccess[silWithFolder.folderUID] = hasAccess
			}
		}
		if hasAccess {
			result = append(result, silWithFolder.Silence)
		}
	}
	return result, nil
}

// AuthorizeReadSilence checks if user has access to read a silence.
func (s SilenceService) AuthorizeReadSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	canAll, err := s.authorizeReadSilencePreConditions(ctx, user)
	if canAll || err != nil { // return early if user can either read all silences or there is error
		return err
	}

	silWithFolder, err := s.withFolders(ctx, user.GetOrgID(), silence)
	if err != nil || len(silWithFolder) != 1 {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}

	return s.authorizeReadSilence(ctx, user, silWithFolder[0])
}

// authorizeReadSilencePreConditions checks necessary preconditions for reading silences. Returns true if user can
// read all silences. Returns error if user does not have access to read any silences.
func (s SilenceService) authorizeReadSilencePreConditions(ctx context.Context, user identity.Requester) (bool, error) {
	canAll, err := s.HasAccess(ctx, user, readAllSilencesEvaluator)
	if canAll || err != nil { // return early if user can either read all silences or there is error
		return canAll, err
	}

	can, err := s.HasAccess(ctx, user, readSomeSilenceEvaluator)
	if err != nil {
		return false, err
	}
	if !can { // User does not have silence permissions at all.
		return false, NewAuthorizationErrorWithPermissions("read any silences", readSomeSilenceEvaluator)
	}
	return false, nil
}

// authorizeReadSilence checks if user has access to read a silence given precondition checks have passed.
func (s SilenceService) authorizeReadSilence(ctx context.Context, user identity.Requester, silence *silenceWithFolder) error {
	if silence.ruleUID == nil {
		return nil // No rule metadata means that this is a general silence and at this point the user can read them
	}

	if silence.folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("read silence for rule %s", *silence.ruleUID))
	}
	return s.HasAccessOrError(ctx, user, readRuleSilenceEvaluator(silence.folderUID), func() string {
		return "read silence"
	})
}

// AuthorizeCreateSilence checks if user has access to create a silence. Returns ErrAuthorizationBase if user is not authorized
func (s SilenceService) AuthorizeCreateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	canAny, err := s.authorizeCreateSilencePreConditions(ctx, user)
	if canAny || err != nil { // return early if user can either create any silence or there is an error
		return err
	}

	silWithFolder, err := s.withFolders(ctx, user.GetOrgID(), silence)
	if err != nil || len(silWithFolder) != 1 {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}

	return s.authorizeCreateSilence(ctx, user, silWithFolder[0])
}

// authorizeCreateSilencePreConditions checks necessary preconditions for creating silences. Returns true if user can
// create any silence. Returns error if user does not have access to create any silences at all.
func (s SilenceService) authorizeCreateSilencePreConditions(ctx context.Context, user identity.Requester) (bool, error) {
	canAny, err := s.HasAccess(ctx, user, createAnySilenceEvaluator)
	if err != nil || canAny {
		// return early if user can either create any silence or there is an error
		return canAny, err
	}

	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, createSomeRuleSilenceEvaluator, func() string { return "create any silences" }); err != nil {
		return false, err
	}

	return false, nil
}

// authorizeCreateSilence checks if user has access to create a silence given precondition checks have passed.
func (s SilenceService) authorizeCreateSilence(ctx context.Context, user identity.Requester, silence *silenceWithFolder) error {
	if silence.ruleUID == nil {
		return s.HasAccessOrError(ctx, user, createGeneralSilenceEvaluator, func() string {
			return "create a general silence"
		})
	}

	if silence.folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("create silence for rule %s", *silence.ruleUID))
	}
	return s.HasAccessOrError(ctx, user, createRuleSilenceEvaluator(silence.folderUID), func() string {
		return fmt.Sprintf("create silence for rule %s", *silence.ruleUID)
	})
}

// AuthorizeUpdateSilence checks if user has access to update\expire a silence. Returns ErrAuthorizationBase if user is not authorized
func (s SilenceService) AuthorizeUpdateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	canAny, err := s.authorizeUpdateSilencePreConditions(ctx, user)
	if canAny || err != nil { // return early if user can either update any silence or there is an error
		return err
	}

	silWithFolder, err := s.withFolders(ctx, user.GetOrgID(), silence)
	if err != nil || len(silWithFolder) != 1 {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}

	return s.authorizeUpdateSilence(ctx, user, silWithFolder[0])
}

// authorizeUpdateSilencePreConditions checks necessary preconditions for updating silences. Returns true if user can
// update any silence. Returns error if user does not have access to update any silences at all.
func (s SilenceService) authorizeUpdateSilencePreConditions(ctx context.Context, user identity.Requester) (bool, error) {
	canAny, err := s.HasAccess(ctx, user, updateAnySilenceEvaluator)
	if err != nil || canAny {
		// return early if user can either update any silence or there is an error
		return canAny, err
	}

	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, updateSomeRuleSilenceEvaluator, func() string { return "update some silences" }); err != nil {
		return false, err
	}

	return false, nil
}

// authorizeUpdateSilence checks if user has access to update a silence given precondition checks have passed.
func (s SilenceService) authorizeUpdateSilence(ctx context.Context, user identity.Requester, silence *silenceWithFolder) error {
	if silence.ruleUID == nil {
		return s.HasAccessOrError(ctx, user, updateGeneralSilenceEvaluator, func() string {
			return "update a general silence"
		})
	}

	if silence.folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("create update for rule %s", *silence.ruleUID))
	}
	return s.HasAccessOrError(ctx, user, updateRuleSilenceEvaluator(silence.folderUID), func() string {
		return fmt.Sprintf("update silence for rule %s", *silence.ruleUID)
	})
}

func (s SilenceService) SilenceAccess(ctx context.Context, user identity.Requester, silences []*models.Silence) (map[*models.Silence]map[models.SilencePermission]struct{}, error) {
	canReadAll, readAnyErr := s.authorizeReadSilencePreConditions(ctx, user)
	if readAnyErr != nil {
		// Read permission is required for all actions.
		// If user can't read any silences, we don't need to check other permissions.
		return toPermissions(silences), nil
	}

	canUpdateAny, updateErr := s.authorizeUpdateSilencePreConditions(ctx, user)
	canCreateAny, createErr := s.authorizeCreateSilencePreConditions(ctx, user)
	if canReadAll && canUpdateAny && canCreateAny {
		// Shortcut for the case when user has full permissions. We don't need to hit the database to find folder UIDs.
		return toPermissions(silences, models.SilencePermissionRead, models.SilencePermissionWrite, models.SilencePermissionCreate), nil
	}

	silencesWithFolders, err := s.withFolders(ctx, user.GetOrgID(), silences...)
	if err != nil {
		return nil, err
	}

	result := make(map[*models.Silence]map[models.SilencePermission]struct{}, len(silences))
	namespacesByAccess := make(map[string]map[models.SilencePermission]struct{}) // caches results of permissions check for each namespace to avoid repeated checks for the same folder
	for _, silWithFolder := range silencesWithFolders {
		if perms, ok := namespacesByAccess[silWithFolder.folderUID]; ok {
			result[silWithFolder.Silence] = maps.Clone(perms)
			continue
		}

		permSet := make(map[models.SilencePermission]struct{})
		if !canReadAll {
			if err := s.authorizeReadSilence(ctx, user, silWithFolder); err != nil {
				// Read permission is required for all actions. If user can't read the silence, we don't need to check other permissions.
				result[silWithFolder.Silence] = permSet
				namespacesByAccess[silWithFolder.folderUID] = permSet
				continue
			}
		}

		permSet[models.SilencePermissionRead] = struct{}{}
		if canUpdateAny {
			permSet[models.SilencePermissionWrite] = struct{}{}
		} else if updateErr == nil {
			if err := s.authorizeUpdateSilence(ctx, user, silWithFolder); err == nil {
				permSet[models.SilencePermissionWrite] = struct{}{}
			}
		}
		if canCreateAny {
			permSet[models.SilencePermissionCreate] = struct{}{}
		} else if createErr == nil {
			if err := s.authorizeCreateSilence(ctx, user, silWithFolder); err == nil {
				permSet[models.SilencePermissionCreate] = struct{}{}
			}
		}
		result[silWithFolder.Silence] = permSet
		namespacesByAccess[silWithFolder.folderUID] = permSet
	}
	return result, nil
}

// withFolders resolves rule UIDs to folder UIDs for rule-specific silences and returns a list of silenceWithFolder
// that includes rule information, if available.
func (s SilenceService) withFolders(ctx context.Context, orgID int64, silences ...*models.Silence) ([]*silenceWithFolder, error) {
	result := make([]*silenceWithFolder, 0, len(silences))
	ruleUIDs := make(map[string]struct{})
	for _, silence := range silences {
		silWithFolder := silenceWithFolder{Silence: silence, ruleUID: silence.GetRuleUID()}
		if silWithFolder.ruleUID != nil {
			ruleUIDs[*silWithFolder.ruleUID] = struct{}{}
		}
		result = append(result, &silWithFolder)
	}

	if len(ruleUIDs) == 0 {
		return result, nil
	}

	namespaceByRuleUID, err := s.store.GetNamespacesByRuleUID(ctx, orgID, maps.Keys(ruleUIDs)...)
	if err != nil {
		return nil, err
	}

	for _, silWithFolder := range result {
		if silWithFolder.ruleUID != nil {
			silWithFolder.folderUID = namespaceByRuleUID[*silWithFolder.ruleUID]
		}
	}
	return result, nil
}

func toPermissions(silences []*models.Silence, perms ...models.SilencePermission) map[*models.Silence]map[models.SilencePermission]struct{} {
	permSet := make(map[models.SilencePermission]struct{}, len(perms))
	for _, perm := range perms {
		permSet[perm] = struct{}{}
	}
	result := make(map[*models.Silence]map[models.SilencePermission]struct{}, len(silences))
	for _, silence := range silences {
		result[silence] = maps.Clone(permSet)
	}
	return result
}
