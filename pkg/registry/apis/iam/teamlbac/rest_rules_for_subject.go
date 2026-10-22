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

	// Listing through the existing Team store batches legacy membership reads
	// and retains storage-mode selection without requiring the public Team API.
	// Both UID and numeric references can be resolved from each listed Team.
	ruleTeamKeysByUID := make(map[string]struct{})
	ruleTeamKeysByLegacyID := make(map[int64][]string)
	for teamKey := range allRules.Spec.TeamFilters {
		if id, err := strconv.ParseInt(teamKey, 10, 64); err == nil {
			ruleTeamKeysByLegacyID[id] = append(ruleTeamKeysByLegacyID[id], teamKey)
		} else {
			ruleTeamKeysByUID[teamKey] = struct{}{}
		}
	}
	hasLegacyTeamRules := len(ruleTeamKeysByLegacyID) > 0

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.Int("rule_team_count", len(allRules.Spec.TeamFilters)))
	listedTeams, listPages := 0, 0
	defer func() {
		span.SetAttributes(attribute.Int("listed_team_count", listedTeams), attribute.Int("team_list_page_count", listPages))
	}()
	matchedTeam, returnedFilters := false, false
	resolvedRuleTeamKeys := make(map[string]struct{}, len(allRules.Spec.TeamFilters))
	seenLegacyIDs := make(map[int64]string)
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
		for i := range teams.Items {
			team := &teams.Items[i]
			var matchingRuleTeamKeys []string
			if _, ok := ruleTeamKeysByUID[team.Name]; ok {
				matchingRuleTeamKeys = append(matchingRuleTeamKeys, team.Name)
			}
			if hasLegacyTeamRules {
				meta, err := apiutils.MetaAccessor(team)
				if err != nil {
					return nil, "", err
				}
				id := meta.GetDeprecatedInternalID() //nolint:staticcheck // compatibility for pre-normalization TeamLBACRules
				if legacyRuleTeamKeys := ruleTeamKeysByLegacyID[id]; id > 0 && len(legacyRuleTeamKeys) > 0 {
					// Unified Storage checks legacy-ID uniqueness through an
					// eventually consistent index, so ambiguity must still fail
					// here to avoid applying another team's policy.
					if previous, ok := seenLegacyIDs[id]; ok && previous != team.Name {
						return nil, "", apierrors.NewInternalError(fmt.Errorf("legacy team ID %d resolved to more than one team", id))
					}
					seenLegacyIDs[id] = team.Name
					matchingRuleTeamKeys = append(matchingRuleTeamKeys, legacyRuleTeamKeys...)
				}
			}
			for _, ruleTeamKey := range matchingRuleTeamKeys {
				resolvedRuleTeamKeys[ruleTeamKey] = struct{}{}
			}
			if len(matchingRuleTeamKeys) == 0 || !hasMember(team, userUID) {
				continue
			}
			matchedTeam = true
			for _, ruleTeamKey := range matchingRuleTeamKeys {
				filters := allRules.Spec.TeamFilters[ruleTeamKey]
				returnedFilters = returnedFilters || len(filters) > 0
				response.TeamFilters[ruleTeamKey] = append([]string(nil), filters...)
			}
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
	// Only a complete listing establishes which references are missing;
	// existing teams without this user's membership still count as resolved.
	s.metrics.addMissingTeams(len(allRules.Spec.TeamFilters) - len(resolvedRuleTeamKeys))
	if !matchedTeam {
		return response, forSubjectOutcomeNoTeamMembership, nil
	}
	if !returnedFilters {
		return response, forSubjectOutcomeNoApplicableFilters, nil
	}
	return response, forSubjectOutcomeFiltersReturned, nil
}

func hasMember(team *iamv0.Team, userUID string) bool {
	for _, member := range team.Spec.Members {
		if member.Name == userUID {
			return true
		}
	}
	return false
}
