package config

import (
	"context"
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
	// The authorizer keys off the identity kind; guard the helpers' assumptions.
	require.False(t, identity.IsServiceIdentity(ctxFor(t, idHuman)))
	require.True(t, identity.IsServiceIdentity(ctxFor(t, idService)))

	cases := []struct {
		name        string
		id          string
		verb        string
		subresource string
		resource    string // override; defaults to configs
		rbac        bool   // what AccessControl.Evaluate returns
		wantAction  string // action expected to be evaluated; "" => RBAC not consulted
		want        authorizer.Decision
		wantReason  string
	}{
		// Reads (get/list/watch) gate on the read action; decision follows RBAC.
		{name: "read get permitted", id: idHuman, verb: "get", rbac: true, wantAction: accesscontrol.ActionAlertingConfigRead, want: authorizer.DecisionAllow},
		{name: "read get denied", id: idHuman, verb: "get", rbac: false, wantAction: accesscontrol.ActionAlertingConfigRead, want: authorizer.DecisionDeny},
		{name: "read list permitted", id: idHuman, verb: "list", rbac: true, wantAction: accesscontrol.ActionAlertingConfigRead, want: authorizer.DecisionAllow},
		{name: "read watch permitted", id: idHuman, verb: "watch", rbac: true, wantAction: accesscontrol.ActionAlertingConfigRead, want: authorizer.DecisionAllow},

		// patch/update gate on the update action.
		{name: "update permitted", id: idHuman, verb: "update", rbac: true, wantAction: accesscontrol.ActionAlertingConfigUpdate, want: authorizer.DecisionAllow},
		{name: "update denied", id: idHuman, verb: "update", rbac: false, wantAction: accesscontrol.ActionAlertingConfigUpdate, want: authorizer.DecisionDeny},
		{name: "patch permitted", id: idHuman, verb: "patch", rbac: true, wantAction: accesscontrol.ActionAlertingConfigUpdate, want: authorizer.DecisionAllow},

		// /status: reads gate on read, writes on the status-update action.
		{name: "status get permitted", id: idHuman, verb: "get", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingConfigRead, want: authorizer.DecisionAllow},
		{name: "status update permitted", id: idHuman, verb: "update", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingConfigStatusUpdate, want: authorizer.DecisionAllow},
		{name: "status update denied", id: idHuman, verb: "update", subresource: "status", rbac: false, wantAction: accesscontrol.ActionAlertingConfigStatusUpdate, want: authorizer.DecisionDeny},
		{name: "status patch permitted", id: idHuman, verb: "patch", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingConfigStatusUpdate, want: authorizer.DecisionAllow},
		{name: "status create permitted", id: idHuman, verb: "create", subresource: "status", rbac: true, wantAction: accesscontrol.ActionAlertingConfigStatusUpdate, want: authorizer.DecisionAllow},

		// create on the main resource is service-identity only, independent of RBAC
		// (wantAction "" => the authorizer must not consult RBAC).
		{name: "create denied for human", id: idHuman, verb: "create", rbac: true, want: authorizer.DecisionDeny},
		{name: "create allowed for service", id: idService, verb: "create", rbac: false, want: authorizer.DecisionAllow},

		// delete/deletecollection are always rejected (destructive on a singleton).
		{name: "delete denied", id: idService, verb: "delete", rbac: true, want: authorizer.DecisionDeny},
		{name: "deletecollection denied", id: idService, verb: "deletecollection", rbac: true, want: authorizer.DecisionDeny},

		// Unknown verbs fall through to no opinion (main resource and /status).
		{name: "unknown verb on main", id: idHuman, verb: "connect", rbac: true, want: authorizer.DecisionNoOpinion},
		{name: "unknown verb on status", id: idHuman, verb: "connect", subresource: "status", rbac: true, want: authorizer.DecisionNoOpinion},

		// Guard rails: other resources are none of this authorizer's business,
		// and an unauthenticated request is denied before any RBAC check.
		{name: "non-Config resource", id: idHuman, verb: "get", resource: "receivers", rbac: true, want: authorizer.DecisionNoOpinion},
		{name: "missing requester", id: idNone, verb: "get", rbac: true, want: authorizer.DecisionDeny, wantReason: "valid user is required"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ac := &recordingAC{FakeAccessControl: actest.FakeAccessControl{ExpectedEvaluate: tc.rbac}}
			a := attrs(tc.verb, tc.subresource)
			if tc.resource != "" {
				a.Resource = tc.resource
			}

			decision, reason, err := Authorize(ctxFor(t, tc.id), ac, a)
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
