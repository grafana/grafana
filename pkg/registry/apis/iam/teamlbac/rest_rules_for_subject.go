package teamlbac

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
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
	teamGetter rest.Getter
	teamLister teamLister
	tracer     trace.Tracer
	logger     log.Logger
}

type teamLister interface {
	List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error)
}

func NewRulesForSubjectREST(ruleGetter rest.Getter, teamGetter rest.Getter, teamLister teamLister, tracer trace.Tracer) *RulesForSubjectREST {
	return &RulesForSubjectREST{
		ruleGetter: ruleGetter,
		teamGetter: teamGetter,
		teamLister: teamLister,
		tracer:     tracer,
		logger:     log.New("teamlbac.for-subject"),
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
		ctx, span := s.tracer.Start(req.Context(), "teamlbac.for-subject")
		defer span.End()

		requestInfo, ok := k8srequest.RequestInfoFrom(req.Context())
		if !ok || len(requestInfo.Parts) != 5 || requestInfo.Parts[2] != "for-subject" {
			responder.Error(apierrors.NewBadRequest("expected /for-subject/{type}/{uid}"))
			return
		}
		subjectType := requestInfo.Parts[3]
		subjectUID := requestInfo.Parts[4]
		if subjectType != userSubjectType {
			responder.Error(apierrors.NewBadRequest(fmt.Sprintf("unsupported subjectType %q", subjectType)))
			return
		}
		if subjectUID == "" {
			responder.Error(apierrors.NewBadRequest("subjectUID is required"))
			return
		}

		response, err := s.getRulesForUser(common.WithSubresourceNamespace(ctx), datasourceName, subjectUID)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, response)
	}), nil
}

func (s *RulesForSubjectREST) getRulesForUser(ctx context.Context, datasourceName, userUID string) (*iamv0.GetTeamLBACRulesForSubjectResponse, error) {
	// TeamLBACRule metadata.name identifies the datasource as
	// "<datasource type>.<datasource UID>".
	logger := s.logger.FromContext(ctx)
	namespace := k8srequest.NamespaceValue(ctx)
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
		return response, nil
	}
	if err != nil {
		return nil, err
	}
	allRules, ok := obj.(*iamv0.TeamLBACRule)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("unexpected TeamLBACRule object type %T", obj))
	}

	if len(allRules.Spec.TeamFilters) == 0 {
		return response, nil
	}

	// Looking up only the teams referenced by this rule keeps work proportional
	// to the datasource policy and works through the same mode-aware Team store.
	// The tradeoff is one Team read, including its full membership list, per key.
	// A reverse membership lookup can therefore be cheaper when a rule references
	// many teams, but it returns every team for the user and legacy numeric rule
	// keys would still need separate resolution.
	missingTeamKeys := make([]string, 0)
	for teamKey, filters := range allRules.Spec.TeamFilters {
		if _, err := strconv.ParseInt(teamKey, 10, 64); err == nil {
			// Numeric keys are retained only for rules written before team UIDs
			// were normalized. Keep each compatibility lookup visible until those
			// rules have been migrated.
			logger.Warn("TeamLBACRule contains numeric team key; using legacy-ID compatibility lookup",
				"namespace", namespace, "datasource", datasourceName, "teamKey", teamKey)
		}
		team, err := s.getTeam(storageCtx, teamKey)
		if err != nil {
			return nil, err
		}
		if team == nil {
			missingTeamKeys = append(missingTeamKeys, teamKey)
			continue
		}
		if !hasMember(team, userUID) {
			continue
		}
		response.TeamFilters[teamKey] = append([]string(nil), filters...)
	}
	if len(missingTeamKeys) > 0 {
		// Admission removes references to missing teams, so seeing one here
		// means the stored rule predates cleanup or bypassed normal writes.
		logger.Warn("TeamLBACRule references teams that do not exist",
			"namespace", namespace, "datasource", datasourceName, "teamKeys", missingTeamKeys)
	}
	return response, nil
}

func (s *RulesForSubjectREST) getTeam(ctx context.Context, teamKey string) (*iamv0.Team, error) {
	// Non-numeric keys are canonical Team UIDs, which are also the Team resource names.
	if _, err := strconv.ParseInt(teamKey, 10, 64); err != nil {
		obj, err := s.teamGetter.Get(ctx, teamKey, &metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		team, ok := obj.(*iamv0.Team)
		if !ok {
			return nil, apierrors.NewInternalError(fmt.Errorf("unexpected Team object type %T", obj))
		}
		return team, nil
	}

	selector := labels.SelectorFromSet(labels.Set{
		apiutils.LabelKeyDeprecatedInternalID: teamKey, //nolint:staticcheck // compatibility for pre-normalization TeamLBACRules
	})
	obj, err := s.teamLister.List(ctx, &metainternalversion.ListOptions{
		LabelSelector: selector,
		Limit:         2,
	})
	if err != nil {
		return nil, err
	}
	teams, ok := obj.(*iamv0.TeamList)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("unexpected Team list object type %T", obj))
	}
	if len(teams.Items) == 0 {
		return nil, nil
	}
	if len(teams.Items) > 1 {
		return nil, apierrors.NewInternalError(fmt.Errorf("legacy team ID %q resolved to more than one team", teamKey))
	}
	return &teams.Items[0], nil
}

func hasMember(team *iamv0.Team, userUID string) bool {
	for _, member := range team.Spec.Members {
		if member.Name == userUID {
			return true
		}
	}
	return false
}
