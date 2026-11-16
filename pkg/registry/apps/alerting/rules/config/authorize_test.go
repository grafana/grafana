package config

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
)

// recordingAC wraps the fake AccessControl so a test can both control the
// Evaluate result and assert which action was evaluated.
type recordingAC struct {
	actest.FakeAccessControl
	last accesscontrol.Evaluator
}

func (r *recordingAC) Evaluate(ctx context.Context, u identity.Requester, ev accesscontrol.Evaluator) (bool, error) {
	r.last = ev
	return r.FakeAccessControl.Evaluate(ctx, u, ev)
}

func attrs(verb, subresource string) authorizer.AttributesRecord {
	return authorizer.AttributesRecord{
		Verb:            verb,
		APIGroup:        ResourceInfo.GroupResource().Group,
		Resource:        ResourceInfo.GroupResource().Resource,
		Subresource:     subresource,
		Name:            "default",
		Namespace:       "default",
		ResourceRequest: true,
	}
}

const (
	idHuman   = "human"   // an authenticated end user
	idService = "service" // the in-process service identity
	idNone    = "none"    // no requester in context
)

func ctxFor(t *testing.T, kind string) context.Context {
	t.Helper()
	switch kind {
	case idHuman:
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: types.TypeUser, UserID: 1, UserUID: "1", OrgID: 1,
		})
	case idService:
		ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
		return ctx
	case idNone:
		return context.Background()
	default:
		t.Fatalf("unknown identity kind %q", kind)
		return nil
	}
}

func TestAuthorize(t *testing.T) {
	cases := []struct {
		name        string
		id          string
		verb        string
		subresource string
		resource    string // override; defaults to configs
		noRequester bool
		rbac        bool   // what AccessControl.Evaluate returns
		wantAction  string // action expected to be evaluated; "" => RBAC not consulted
		want        authorizer.Decision
		wantReason  string
	}{
		// Reads (get/list/watch) gate on the read action; decision follows RBAC.
		{name: "read get permitted", id: idHuman, verb: "get", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigRead, want: authorizer.DecisionAllow},
		{name: "read get denied", id: idHuman, verb: "get", rbac: false, wantAction: accesscontrol.ActionAlertingRulesConfigRead, want: authorizer.DecisionDeny},
		{name: "read list permitted", id: idHuman, verb: "list", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigRead, want: authorizer.DecisionAllow},
		{name: "read watch permitted", id: idHuman, verb: "watch", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigRead, want: authorizer.DecisionAllow},

		// patch/update gate on the update action.
		{name: "update permitted", id: idHuman, verb: "update", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigUpdate, want: authorizer.DecisionAllow},
		{name: "update denied", id: idHuman, verb: "update", rbac: false, wantAction: accesscontrol.ActionAlertingRulesConfigUpdate, want: authorizer.DecisionDeny},
		{name: "patch permitted", id: idHuman, verb: "patch", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigUpdate, want: authorizer.DecisionAllow},

		// create is service-identity only: the singleton is seeded automatically,
		// so humans/GitOps are denied (without consulting RBAC) and update the
		// seeded object instead. The service identity (the seeder) is gated on
		// the update permission like any other write.
		{name: "human create denied even with update", id: idHuman, verb: "create", rbac: true, want: authorizer.DecisionDeny, wantReason: "Config is a singleton seeded automatically; it cannot be created via the API"},
		{name: "service create permitted with update", id: idService, verb: "create", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigUpdate, want: authorizer.DecisionAllow},
		{name: "service create denied without update", id: idService, verb: "create", rbac: false, wantAction: accesscontrol.ActionAlertingRulesConfigUpdate, want: authorizer.DecisionDeny},

		// /status: reads gate on read, writes on the status-update action.
		{name: "status get permitted", verb: "get", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigRead, want: authorizer.DecisionAllow},
		{name: "status create permitted", verb: "create", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigStatusUpdate, want: authorizer.DecisionAllow},
		{name: "status update permitted", verb: "update", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigStatusUpdate, want: authorizer.DecisionAllow},
		{name: "status update denied", verb: "update", subresource: "status", rbac: false, wantAction: accesscontrol.ActionAlertingRulesConfigStatusUpdate, want: authorizer.DecisionDeny},
		{name: "status patch permitted", verb: "patch", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingRulesConfigStatusUpdate, want: authorizer.DecisionAllow},

		// Humans cannot delete the singleton even with delete permission.
		{name: "delete denied", verb: "delete", rbac: true, want: authorizer.DecisionDeny},
		{name: "deletecollection denied", verb: "deletecollection", rbac: true, want: authorizer.DecisionDeny},
		{name: "service delete permitted", id: idService, verb: "delete", rbac: true, wantAction: ActionDelete, want: authorizer.DecisionAllow},
		{name: "service collection delete permitted", id: idService, verb: "deletecollection", rbac: true, wantAction: ActionDelete, want: authorizer.DecisionAllow},
		{name: "service delete denied without permission", id: idService, verb: "delete", rbac: false, wantAction: ActionDelete, want: authorizer.DecisionDeny},

		// Unknown verbs fall through to no opinion (main resource and /status).
		{name: "unknown verb on main", verb: "connect", rbac: true, want: authorizer.DecisionNoOpinion},
		{name: "unknown verb on status", verb: "connect", subresource: "status", rbac: true, want: authorizer.DecisionNoOpinion},

		// Guard rails: other resources are none of this authorizer's business,
		// and an unauthenticated request is denied before any RBAC check.
		{name: "non-Config resource", verb: "get", resource: "alertrules", rbac: true, want: authorizer.DecisionNoOpinion},
		{name: "missing requester", verb: "get", noRequester: true, rbac: true, want: authorizer.DecisionDeny, wantReason: "valid user is required"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedEvaluate: tc.rbac}}
			a := attrs(tc.verb, tc.subresource)
			if tc.resource != "" {
				a.Resource = tc.resource
			}

			id := tc.id
			if id == "" {
				id = idHuman
			}
			if tc.noRequester {
				id = idNone
			}
			decision, reason, err := Authorize(ctxFor(t, id), ac, a)
			require.NoError(t, err)
			require.Equal(t, tc.want, decision)
			if tc.wantReason != "" {
				require.Equal(t, tc.wantReason, reason)
			}

			if tc.wantAction == "" {
				require.Nil(t, ac.last, "RBAC must not be consulted")
			} else {
				require.NotNil(t, ac.last)
				require.Equal(t, tc.wantAction, ac.last.String())
			}
		})
	}
}

func TestAuthorizeDeleteTenantAndPermission(t *testing.T) {
	for _, verb := range []string{"delete", "deletecollection"} {
		for _, namespace := range []string{"", "*", "org-2", "invalid", "stacks-2"} {
			t.Run(verb+" rejects namespace "+namespace, func(t *testing.T) {
				ctx, _ := identity.WithServiceIdentityForSingleNamespace(context.Background(), "default")
				ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedEvaluate: true}}
				a := attrs(verb, "")
				a.Namespace = namespace
				decision, reason, err := Authorize(ctx, ac, a)
				require.NoError(t, err)
				require.Equal(t, authorizer.DecisionDeny, decision)
				require.Contains(t, reason, "namespace")
				require.Nil(t, ac.last)
			})
		}
	}
	t.Run("wildcard service identity cannot delete another org", func(t *testing.T) {
		ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedEvaluate: true}}
		a := attrs("deletecollection", "")
		a.Namespace = "org-2"
		decision, _, err := Authorize(ctxFor(t, idService), ac, a)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Nil(t, ac.last)
	})
	t.Run("permission evaluation failure denies deletion", func(t *testing.T) {
		ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedErr: errors.New("authorization unavailable")}}
		decision, reason, err := Authorize(ctxFor(t, idService), ac, attrs("delete", ""))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Contains(t, reason, "authorization unavailable")
	})
	t.Run("delete permission is scoped to the singleton", func(t *testing.T) {
		ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedEvaluate: true}}
		_, _, err := Authorize(ctxFor(t, idService), ac, attrs("delete", ""))
		require.NoError(t, err)
		require.True(t, ac.last.Evaluate(map[string][]string{ActionDelete: {"rules-configs:uid:default"}}))
		require.False(t, ac.last.Evaluate(map[string][]string{ActionDelete: {"rules-configs:uid:other"}}))
	})
}
