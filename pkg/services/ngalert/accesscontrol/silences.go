package accesscontrol

import (
	"context"
	"fmt"

	"golang.org/x/exp/maps"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
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
	readAllSilencesEvaluator = ac.EvalPermission(instancesRead)
	// asserts that user has access to silences at all
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
	// asserts that user has access to create global silences
	createGlobalSilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesCreate), readSomeSilenceEvaluator)
	// asserts that user has access to create silences at all
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
	// asserts that user has access to update global silences
	updateGlobalSilenceEvaluator = ac.EvalAll(ac.EvalPermission(instancesWrite), readSomeSilenceEvaluator)
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

type Silence interface {
	GetRuleUID() *string
}

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

// FilterByAccess filters the given list of silences based on the access control permissions of the user.
// Global silence (one that is not attached to a particular rule) is considered available to all users.
// For silences that are not attached to a rule, are checked against authorization.
// This method is more preferred when many silences need to be checked.
func (s SilenceService) FilterByAccess(ctx context.Context, user identity.Requester, silences ...Silence) ([]Silence, error) {
	canAll, err := s.HasAccess(ctx, user, readAllSilencesEvaluator)
	if err != nil || canAll { // return early if user can either read all silences or there is an error
		return silences, err
	}
	canSome, err := s.HasAccess(ctx, user, readSomeSilenceEvaluator)
	if err != nil || !canSome {
		return nil, err
	}
	result := make([]Silence, 0, len(silences))
	keys := make(map[string][]Silence, len(silences))
	for _, silence := range silences {
		ruleUID := silence.GetRuleUID()
		if ruleUID == nil { // if this is a global silence
			result = append(result, silence)
			continue
		}
		key := *ruleUID
		keys[key] = append(keys[key], silence)
	}
	if len(keys) == 0 { // if only global silences are provided no need in other checks
		return result, nil
	}
	namespaces, err := s.store.GetNamespacesByRuleUID(ctx, user.GetOrgID(), maps.Keys(keys)...)
	if err != nil {
		return nil, err
	}

	for key, silence := range keys {
		ns, ok := namespaces[key]
		if !ok {
			continue
		}
		hasAccess, err := s.HasAccess(ctx, user, readRuleSilenceEvaluator(ns))
		if err != nil {
			return nil, err
		}
		if !hasAccess {
			continue
		}
		result = append(result, silence...)
	}
	return result, nil
}

// AuthorizeReadSilence checks if user has access to read a silence
func (s SilenceService) AuthorizeReadSilence(ctx context.Context, user identity.Requester, silence Silence) error {
	canAll, err := s.HasAccess(ctx, user, readAllSilencesEvaluator)
	if canAll || err != nil { // return early if user can either read all silences or there is error
		return err
	}

	can, err := s.HasAccess(ctx, user, readSomeSilenceEvaluator)
	if err != nil {
		return err
	}
	if !can { // if user cannot read global silences, then it does not have silence permissions at all.
		return NewAuthorizationErrorWithPermissions("read any silences", readSomeSilenceEvaluator)
	}
	ruleUID := silence.GetRuleUID()
	if ruleUID == nil {
		return nil // user can read global
	}

	// otherwise resolve rule key to the action's scope
	folderUID, err := s.ruleUIDToFolderUID(ctx, user.GetOrgID(), *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("read silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, readRuleSilenceEvaluator(folderUID), func() string {
		return "read silence"
	})
}

// AuthorizeCreateSilence checks if user has access to create a silence. Returns ErrAuthorizationBase if user is not authorized
func (s SilenceService) AuthorizeCreateSilence(ctx context.Context, user identity.Requester, silence Silence) error {
	canAny, err := s.HasAccess(ctx, user, createAnySilenceEvaluator)
	if err != nil || canAny {
		// return early if user can either create any silence or there is an error
		return err
	}
	ruleUID := silence.GetRuleUID()
	if ruleUID == nil {
		return s.HasAccessOrError(ctx, user, createGlobalSilenceEvaluator, func() string {
			return "create global silence"
		})
	}
	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, createSomeRuleSilenceEvaluator, func() string { return "create any silences" }); err != nil {
		return err
	}
	folderUID, err := s.ruleUIDToFolderUID(ctx, user.GetOrgID(), *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("create silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, createRuleSilenceEvaluator(folderUID), func() string {
		return fmt.Sprintf("create silence for rule %s", *ruleUID)
	})
}

// AuthorizeUpdateSilence checks if user has access to update\expire a silence. Returns ErrAuthorizationBase if user is not authorized
func (s SilenceService) AuthorizeUpdateSilence(ctx context.Context, user identity.Requester, silence Silence) error {
	canAny, err := s.HasAccess(ctx, user, updateAnySilenceEvaluator)
	if err != nil || canAny {
		// return early if user can either update any silence or there is an error
		return err
	}
	ruleUID := silence.GetRuleUID()
	if ruleUID == nil {
		return s.HasAccessOrError(ctx, user, updateGlobalSilenceEvaluator, func() string {
			return "update global silence"
		})
	}
	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, updateSomeRuleSilenceEvaluator, func() string { return "update any silences" }); err != nil {
		return err
	}
	folderUID, err := s.ruleUIDToFolderUID(ctx, user.GetOrgID(), *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if folderUID == "" { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("update silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, updateRuleSilenceEvaluator(folderUID), func() string {
		return fmt.Sprintf("update silence for rule %s", *ruleUID)
	})
}

func (s SilenceService) ruleUIDToFolderUID(ctx context.Context, orgID int64, ruleUID string) (string, error) {
	namespaces, err := s.store.GetNamespacesByRuleUID(ctx, orgID, ruleUID)
	if err != nil {
		return "", err
	}
	uid, ok := namespaces[ruleUID]
	if !ok {
		return "", nil
	}
	return uid, nil
}
