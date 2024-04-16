package accesscontrol

import (
	"context"
	"fmt"

	"golang.org/x/exp/maps"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
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

type Silence interface {
	GetRuleUID() *string
}

type RuleStore interface {
	GetRuleGroupsByRuleUIDs(ctx context.Context, orgID int64, uids ...string) (map[models.AlertRuleGroupKey]models.RulesGroup, error)
}

type SilenceService struct {
	genericService
	rulesSvc RuleService
	store    RuleStore
}

func NewSilenceService(ac ac.AccessControl, store RuleStore) *SilenceService {
	return &SilenceService{
		genericService: genericService{
			ac: ac,
		},
		rulesSvc: RuleService{
			genericService{
				ac: ac,
			},
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
	silencesByRuleUID := make(map[string][]Silence, len(silences))
	for _, silence := range silences {
		ruleUID := silence.GetRuleUID()
		if ruleUID == nil { // if this is a general silence
			result = append(result, silence)
			continue
		}
		key := *ruleUID
		silencesByRuleUID[key] = append(silencesByRuleUID[key], silence)
	}
	if len(silencesByRuleUID) == 0 { // if only general silences are provided no need in other checks
		return result, nil
	}
	groups, err := s.store.GetRuleGroupsByRuleUIDs(ctx, user.GetOrgID(), maps.Keys(silencesByRuleUID)...)
	if err != nil {
		return nil, err
	}
	namespacesByAccess := make(map[string]bool) // caches results of permissions check for each namespace to avoid repeated checks for the same folder
	for groupKey, group := range groups {
		hasAccess, ok := namespacesByAccess[groupKey.NamespaceUID]
		if ok && !hasAccess { // if silences are not available in this folder, skip the group immediately
			continue
		}
		var groupAccess *bool
		for _, rule := range group {
			// check if there is silence for this rule that we need to check access to
			ruleSilences, ok := silencesByRuleUID[rule.UID]
			if !ok {
				continue
			}
			if groupAccess == nil { // means that there was another rule in this group that has silences, and therefore we do not need to check permissions again
				has, err := s.rulesSvc.HasAccessToRuleGroup(ctx, user, group)
				if err != nil {
					return nil, err
				}
				groupAccess = util.Pointer(has)
			}
			if !*groupAccess {
				continue
			}
			result = append(result, ruleSilences...)
		}
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
	if !can { // User does not have silence permissions at all.
		return NewAuthorizationErrorWithPermissions("read any silences", readSomeSilenceEvaluator)
	}
	ruleUID := silence.GetRuleUID()
	if ruleUID == nil {
		return nil // no rule UID means that this is a general silence and at this point the user can read them
	}
	// otherwise resolve rule UID to a group key to get the action's scope
	groupKey, err := s.ruleUIDtoGroupKey(ctx, user, *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if groupKey == nil { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("read silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, readRuleSilenceEvaluator(groupKey.NamespaceUID), func() string {
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
		return s.HasAccessOrError(ctx, user, createGeneralSilenceEvaluator, func() string {
			return "create a general silence"
		})
	}
	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, createSomeRuleSilenceEvaluator, func() string { return "create any silences" }); err != nil {
		return err
	}
	groupKey, err := s.ruleUIDtoGroupKey(ctx, user, *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if groupKey == nil { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("create silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, createRuleSilenceEvaluator(groupKey.NamespaceUID), func() string {
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
		return s.HasAccessOrError(ctx, user, updateGeneralSilenceEvaluator, func() string {
			return "update a general silence"
		})
	}
	// pre-check whether a user has at least some basic permissions before hit the store
	if err := s.HasAccessOrError(ctx, user, updateSomeRuleSilenceEvaluator, func() string { return "update any silences" }); err != nil {
		return err
	}
	groupKey, err := s.ruleUIDtoGroupKey(ctx, user, *ruleUID)
	if err != nil {
		return fmt.Errorf("resolve rule UID to folder UID: %w", err)
	}
	if groupKey == nil { // if we did not find folder by rule UID then it does not exist.
		return NewAuthorizationErrorGeneric(fmt.Sprintf("update silence for rule %s", *ruleUID))
	}
	return s.HasAccessOrError(ctx, user, updateRuleSilenceEvaluator(groupKey.NamespaceUID), func() string {
		return fmt.Sprintf("update silence for rule %s", *ruleUID)
	})
}

func (s SilenceService) ruleUIDtoGroupKey(ctx context.Context, user identity.Requester, ruleUID string) (*models.AlertRuleGroupKey, error) {
	groups, err := s.store.GetRuleGroupsByRuleUIDs(ctx, user.GetOrgID(), ruleUID)
	if err != nil {
		return nil, err
	}
	for key, group := range groups {
		err = s.rulesSvc.AuthorizeAccessToRuleGroup(ctx, user, group)
		if err != nil {
			return nil, err
		}
		return &key, nil
	}
	return nil, nil // no rule in database
}
