package teamlbac

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

const userSubjectType = "user"

var (
	_ rest.Storage   = (*RulesForSubjectREST)(nil)
	_ rest.Scoper    = (*RulesForSubjectREST)(nil)
	_ rest.Connecter = (*RulesForSubjectREST)(nil)
)

// RulesForSubjectREST evaluates a TeamLBACRule for a subject while IAM still
// owns both rule and team storage selection. Callers receive Kubernetes-style
// filters and remain responsible for converting them to a datasource-specific
// representation.
type RulesForSubjectREST struct {
	ruleGetter rest.Getter
	teamLister teamLister
	tracer     trace.Tracer
	metrics    *forSubjectMetrics
}

type teamLister interface {
	List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error)
}

func NewRulesForSubjectREST(ruleGetter rest.Getter, teamLister teamLister, tracer trace.Tracer, reg prometheus.Registerer) *RulesForSubjectREST {
	return &RulesForSubjectREST{
		ruleGetter: ruleGetter,
		teamLister: teamLister,
		tracer:     tracer,
		metrics:    newForSubjectMetrics(reg),
	}
}

func (s *RulesForSubjectREST) New() runtime.Object {
	return iamv0.NewGetTeamLBACRulesForSubjectResponse()
}

func (s *RulesForSubjectREST) Destroy() {}

func (s *RulesForSubjectREST) NamespaceScoped() bool {
	return true
}

func (s *RulesForSubjectREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (s *RulesForSubjectREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (s *RulesForSubjectREST) Connect(ctx context.Context, datasourceName string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(_ http.ResponseWriter, req *http.Request) {
		start := time.Now()
		outcome, errorClass := forSubjectOutcomeError, forSubjectErrorInternal
		defer func() { s.metrics.observe(outcome, errorClass, datasourceName, start) }()
		ctx, span := s.tracer.Start(req.Context(), "teamlbac.for-subject")
		defer func() {
			span.SetAttributes(attribute.String("outcome", string(outcome)), attribute.String("error_class", string(errorClass)))
			span.End()
		}()

		requestInfo, ok := k8srequest.RequestInfoFrom(req.Context())
		if !ok || len(requestInfo.Parts) != 5 || requestInfo.Parts[2] != "for-subject" {
			outcome, errorClass = forSubjectOutcomeRejected, forSubjectErrorBadRequest
			responder.Error(apierrors.NewBadRequest("expected /for-subject/{type}/{uid}"))
			return
		}
		subjectType := requestInfo.Parts[3]
		subjectUID := requestInfo.Parts[4]
		if subjectType != userSubjectType {
			outcome, errorClass = forSubjectOutcomeRejected, forSubjectErrorBadRequest
			responder.Error(apierrors.NewBadRequest(fmt.Sprintf("unsupported subjectType %q", subjectType)))
			return
		}
		if subjectUID == "" {
			outcome, errorClass = forSubjectOutcomeRejected, forSubjectErrorBadRequest
			responder.Error(apierrors.NewBadRequest("subjectUID is required"))
			return
		}

		response, result, err := s.getRulesForUser(common.WithSubresourceNamespace(ctx), datasourceName, subjectUID)
		if err != nil {
			errorClass = classifyForSubjectError(err)
			responder.Error(err)
			return
		}
		outcome, errorClass = result, forSubjectErrorNone
		responder.Object(http.StatusOK, response)
	}), nil
}

func (s *RulesForSubjectREST) getRulesForUser(ctx context.Context, datasourceName, userUID string) (*iamv0.GetTeamLBACRulesForSubjectResponse, forSubjectOutcome, error) {
	// TeamLBACRule metadata.name identifies the datasource as
	// "<datasource type>.<datasource UID>".
	response := iamv0.NewGetTeamLBACRulesForSubjectResponse()
	response.TeamFilters = make(map[string][]string)

	// Authorization for the caller is complete before this handler runs. Use an
	// internal service identity for the mode-aware rule and Team storage reads so
	// their own authorization does not depend on the calling service's permissions.
	storageCtx, _ := identity.WithServiceIdentity(ctx, 0)
	obj, err := s.ruleGetter.Get(storageCtx, datasourceName, &metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		// No stored rule means this datasource has no LBAC rules, so return an
		// empty result. Authorization and routing happen before this storage read,
		// so failures from those steps are still returned to the caller.
		return response, forSubjectOutcomeNoRules, nil
	}
	if err != nil {
		return nil, "", err
	}
	allRules, ok := obj.(*iamv0.TeamLBACRule)
	if !ok {
		return nil, "", apierrors.NewInternalError(fmt.Errorf("unexpected TeamLBACRule object type %T", obj))
	}

	if len(allRules.Spec.TeamFilters) == 0 {
		return response, forSubjectOutcomeEmptyRule, nil
	}

	// Record one observation for the entire Team evaluation, not each Team/page.
	// No-rule requests stay out of this timer; no-membership results and errors do not.
	defer s.metrics.observeTeamEvaluation(datasourceName, time.Now())
	evaluation := newSubjectRuleEvaluation(userUID, allRules.Spec.TeamFilters)

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.Int("rule_team_count", len(allRules.Spec.TeamFilters)))
	listedTeams, listPages := 0, 0
	defer func() {
		span.SetAttributes(attribute.Int("listed_team_count", listedTeams), attribute.Int("team_list_page_count", listPages))
	}()
	seenCursors := make(map[string]struct{})
	options := &metainternalversion.ListOptions{Limit: common.MaxListLimit}
	for {
		obj, err := s.teamLister.List(storageCtx, options)
		if err != nil {
			return nil, "", err
		}
		teams, ok := obj.(*iamv0.TeamList)
		if !ok || teams == nil {
			return nil, "", apierrors.NewInternalError(fmt.Errorf("unexpected Team list object type %T", obj))
		}
		listPages++
		listedTeams += len(teams.Items)
		s.metrics.countTeamsWithoutLegacyIDs(teams.Items)
		if err := evaluation.processTeamPage(teams.Items); err != nil {
			return nil, "", err
		}
		if teams.Continue == "" {
			break
		}
		if _, ok := seenCursors[teams.Continue]; ok {
			return nil, "", apierrors.NewInternalError(fmt.Errorf("team list returned a repeated continue token"))
		}
		seenCursors[teams.Continue] = struct{}{}
		options = &metainternalversion.ListOptions{Limit: common.MaxListLimit, Continue: teams.Continue}
	}
	// For the missing-Team counter, assume a rule's Team was deleted if its UID
	// or legacy numeric ID was not found in the complete listing. A listed Team
	// is not missing just because this user is not a member. Rules keyed by numeric
	// IDs depend on Teams retaining their original legacy IDs.
	s.metrics.countMissingTeams(len(allRules.Spec.TeamFilters) - len(evaluation.listedRuleTeamKeys))
	response.TeamFilters = evaluation.subjectRulesByTeamKey
	if !evaluation.subjectBelongsToAnyRuleTeam {
		return response, forSubjectOutcomeNoTeamMembership, nil
	}
	if !evaluation.subjectHasNonEmptyRules {
		return response, forSubjectOutcomeNoApplicableFilters, nil
	}
	return response, forSubjectOutcomeFiltersReturned, nil
}

// subjectRuleEvaluation selects a user's LBAC rules from a datasource's policy.
// Rules are grouped by Team key (a UID or legacy numeric ID), as in the API's
// TeamFilters map. Team pages from the mode-aware store batch legacy membership
// reads without retaining the full Team listing.
type subjectRuleEvaluation struct {
	userUID                     string
	datasourceRulesByTeamKey    map[string][]string
	subjectRulesByTeamKey       map[string][]string
	ruleTeamKeysByUID           map[string]struct{}
	ruleTeamKeysByLegacyID      map[int64][]string
	hasNumericRuleTeamKeys      bool
	listedRuleTeamKeys          map[string]struct{}
	teamUIDByLegacyID           map[int64]string
	subjectBelongsToAnyRuleTeam bool
	subjectHasNonEmptyRules     bool
}

// newSubjectRuleEvaluation groups the stored Team keys (UIDs or legacy numeric
// IDs) for matching against listed Teams, and starts an empty user-rule result.
func newSubjectRuleEvaluation(userUID string, datasourceRulesByTeamKey map[string][]string) *subjectRuleEvaluation {
	evaluation := &subjectRuleEvaluation{
		userUID:                  userUID,
		datasourceRulesByTeamKey: datasourceRulesByTeamKey,
		subjectRulesByTeamKey:    make(map[string][]string),
		ruleTeamKeysByUID:        make(map[string]struct{}),
		ruleTeamKeysByLegacyID:   make(map[int64][]string),
		listedRuleTeamKeys:       make(map[string]struct{}, len(datasourceRulesByTeamKey)),
		teamUIDByLegacyID:        make(map[int64]string),
	}
	for ruleTeamKey := range datasourceRulesByTeamKey {
		if legacyTeamID, err := strconv.ParseInt(ruleTeamKey, 10, 64); err == nil {
			evaluation.ruleTeamKeysByLegacyID[legacyTeamID] = append(evaluation.ruleTeamKeysByLegacyID[legacyTeamID], ruleTeamKey)
		} else {
			evaluation.ruleTeamKeysByUID[ruleTeamKey] = struct{}{}
		}
	}
	evaluation.hasNumericRuleTeamKeys = len(evaluation.ruleTeamKeysByLegacyID) > 0
	return evaluation
}

// processTeamPage records policy Team keys (UIDs or legacy numeric IDs) found in
// this page for the missing-Team counter, regardless of the user's membership.
// It then collects rules only from Teams the user belongs to.
func (e *subjectRuleEvaluation) processTeamPage(teams []iamv0.Team) error {
	for i := range teams {
		team := &teams[i]
		matchingRuleTeamKeys, err := e.matchingRuleTeamKeys(team)
		if err != nil {
			return err
		}
		for _, ruleTeamKey := range matchingRuleTeamKeys {
			e.listedRuleTeamKeys[ruleTeamKey] = struct{}{}
		}
		e.collectRulesForSubject(team, matchingRuleTeamKeys)
	}
	return nil
}

// collectRulesForSubject adds a Team's rules to the result if the user belongs
// to it. A matching Team with no rules is reported separately from no membership.
func (e *subjectRuleEvaluation) collectRulesForSubject(team *iamv0.Team, ruleTeamKeys []string) {
	if len(ruleTeamKeys) == 0 || !hasMember(team, e.userUID) {
		return
	}
	e.subjectBelongsToAnyRuleTeam = true
	for _, ruleTeamKey := range ruleTeamKeys {
		teamRules := e.datasourceRulesByTeamKey[ruleTeamKey]
		if len(teamRules) > 0 {
			e.subjectHasNonEmptyRules = true
		}
		// Changing a returned rule must not change the in-memory source policy.
		e.subjectRulesByTeamKey[ruleTeamKey] = append([]string(nil), teamRules...)
	}
}

// matchingRuleTeamKeys finds the stored policy keys (UIDs or legacy numeric IDs)
// that identify this Team. Returning the original keys lets the caller retrieve
// their rules from the policy map and preserve the response's Team identifiers.
func (e *subjectRuleEvaluation) matchingRuleTeamKeys(team *iamv0.Team) ([]string, error) {
	var matchingRuleTeamKeys []string
	if _, ok := e.ruleTeamKeysByUID[team.Name]; ok {
		matchingRuleTeamKeys = append(matchingRuleTeamKeys, team.Name)
	}
	if !e.hasNumericRuleTeamKeys {
		return matchingRuleTeamKeys, nil
	}
	meta, err := apiutils.MetaAccessor(team)
	if err != nil {
		return nil, err
	}
	legacyTeamID := meta.GetDeprecatedInternalID() //nolint:staticcheck // compatibility for pre-normalization TeamLBACRules
	legacyRuleTeamKeys := e.ruleTeamKeysByLegacyID[legacyTeamID]
	if legacyTeamID <= 0 || len(legacyRuleTeamKeys) == 0 {
		return matchingRuleTeamKeys, nil
	}
	// Unified Storage checks legacy-ID uniqueness through an eventually
	// consistent index, so ambiguity must still fail here to avoid applying
	// another team's policy.
	if previousTeamUID, ok := e.teamUIDByLegacyID[legacyTeamID]; ok && previousTeamUID != team.Name {
		return nil, apierrors.NewInternalError(fmt.Errorf("legacy team ID %d resolved to more than one team", legacyTeamID))
	}
	// Retain this mapping for the duplicate-ID check on subsequent Teams/pages.
	e.teamUIDByLegacyID[legacyTeamID] = team.Name
	return append(matchingRuleTeamKeys, legacyRuleTeamKeys...), nil
}

func hasMember(team *iamv0.Team, userUID string) bool {
	for _, member := range team.Spec.Members {
		if member.Name == userUID {
			return true
		}
	}
	return false
}
