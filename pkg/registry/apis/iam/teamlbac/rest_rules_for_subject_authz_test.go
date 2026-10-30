package teamlbac

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	claims "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	iamteam "github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/team"
)

// Review of the switch from per-Team GETs to a batched LIST raised an authorization
// concern: unlike GET, the legacy Team store's LIST filters results by access.
// Exercise the real store and auth client to prove the handler's internal service
// identity prevents the caller's lack of Team permissions from dropping LBAC rules.
func TestRulesForSubjectRESTListsTeamsWithInternalServiceIdentity(t *testing.T) {
	for _, namespace := range []string{"org-2", "stacks-123"} {
		t.Run(namespace, func(t *testing.T) {
			caller := &identity.StaticRequester{
				Type:      claims.TypeAccessPolicy,
				UserUID:   "query-service",
				Namespace: namespace,
				AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
					Rest: authn.AccessTokenClaims{Permissions: []string{"iam.grafana.app/teamlbacrules:get"}},
				},
			}
			ctx := identity.WithRequester(context.Background(), caller)
			ctx = k8srequest.WithNamespace(ctx, namespace)
			conn := &unexpectedAuthzConnection{t: t}
			accessClient := authz.NewClient(conn)
			tracer := tracing.NewNoopTracerService()
			teamStore := iamteam.NewLegacyStore(&subjectTeamsStore{t: t, namespace: namespace}, accessClient, tracer, nil)

			// The caller may read LBAC rules but cannot list Teams. Without the
			// handler's internal identity, list authorization hides every Team.
			obj, err := teamStore.List(ctx, &metainternalversion.ListOptions{Limit: 10})
			require.NoError(t, err)
			require.Empty(t, obj.(*iamv0.TeamList).Items)

			ruleGetter := getterFunc(func(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
				return &iamv0.TeamLBACRule{Spec: iamv0.TeamLBACRuleSpec{
					TeamFilters: map[string][]string{
						"team-a": {`foo="a"`},
						"team-b": {`foo="b"`},
						"team-c": {`foo="c"`},
					},
				}}, nil
			})
			handler := NewRulesForSubjectREST(ruleGetter, teamStore, tracer, prometheus.NewRegistry())
			responder := &testResponder{}
			httpHandler, err := handler.Connect(context.Background(), "prometheus.datasource-a", nil, responder)
			require.NoError(t, err)
			ctx = k8srequest.WithRequestInfo(ctx, &k8srequest.RequestInfo{Parts: subjectRequestParts("user", "user-a")})
			httpHandler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx))

			require.NoError(t, responder.err)
			require.Equal(t, http.StatusOK, responder.status)
			response := responder.obj.(*iamv0.GetTeamLBACRulesForSubjectResponse)
			require.Equal(t, map[string][]string{
				"team-a": {`foo="a"`},
				"team-b": {`foo="b"`},
			}, response.TeamFilters)
			require.Zero(t, testutil.ToFloat64(handler.metrics.missingTeams))
			require.Zero(t, conn.calls, "internal service authorization must not call the remote authz service")
		})
	}
}

type subjectTeamsStore struct {
	legacy.LegacyIdentityStore
	t         *testing.T
	namespace string
}

func (s *subjectTeamsStore) ListTeams(_ context.Context, ns claims.NamespaceInfo, _ legacy.ListTeamQuery) (*legacy.ListTeamResult, error) {
	s.t.Helper()
	require.Equal(s.t, s.namespace, ns.Value)
	return &legacy.ListTeamResult{Teams: []team.Team{
		{UID: "team-a", ID: 1},
		{UID: "team-b", ID: 2},
		{UID: "team-c", ID: 3},
	}}, nil
}

func (s *subjectTeamsStore) ListTeamBindings(_ context.Context, ns claims.NamespaceInfo, query legacy.ListTeamBindingsQuery) (*legacy.ListTeamBindingsResult, error) {
	s.t.Helper()
	require.Equal(s.t, s.namespace, ns.Value)
	require.ElementsMatch(s.t, []string{"team-a", "team-b", "team-c"}, query.TeamUIDs)
	return &legacy.ListTeamBindingsResult{Bindings: []legacy.TeamMember{
		{TeamUID: "team-a", UserUID: "user-a", Permission: team.PermissionTypeMember},
		{TeamUID: "team-b", UserUID: "user-a", Permission: team.PermissionTypeMember},
		{TeamUID: "team-c", UserUID: "another-user", Permission: team.PermissionTypeMember},
	}}, nil
}

type unexpectedAuthzConnection struct {
	t     *testing.T
	calls int
}

func (c *unexpectedAuthzConnection) Invoke(_ context.Context, method string, _, _ any, _ ...grpc.CallOption) error {
	c.t.Helper()
	c.calls++
	c.t.Errorf("unexpected remote authorization call: %s", method)
	return fmt.Errorf("unexpected remote authorization call: %s", method)
}

func (c *unexpectedAuthzConnection) NewStream(_ context.Context, _ *grpc.StreamDesc, method string, _ ...grpc.CallOption) (grpc.ClientStream, error) {
	c.t.Helper()
	c.calls++
	c.t.Errorf("unexpected remote authorization stream: %s", method)
	return nil, fmt.Errorf("unexpected remote authorization stream: %s", method)
}
