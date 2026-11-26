package appsettings

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		ctx              context.Context
		expectedDecision authorizer.Decision
		expectedReason   string
		expectedErr      bool
		fakeAC           actest.FakeAccessControl
	}{
		{
			name:             "denies when access control evaluation fails",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false, ExpectedErr: fmt.Errorf("eval error")},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "authorization check failed",
			expectedErr:      true,
		},
		{
			name:             "denies when user lacks permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "access denied",
			expectedErr:      false,
		},
		{
			name:             "allows when user has permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: true},
			expectedDecision: authorizer.DecisionAllow,
			expectedReason:   "",
			expectedErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &Builder{
				pluginJSON: plugins.JSONData{
					ID: "test-app",
				},
				authorizer: newSettingsAuthorizer("test-app", pluginaccesscontrol.NewAppAccessChecker(&tt.fakeAC), Options{}),
			}

			auth := builder.GetAuthorizer()
			decision, reason, err := auth.Authorize(tt.ctx, authorizer.AttributesRecord{})

			require.Equal(t, tt.expectedDecision, decision)
			require.Equal(t, tt.expectedReason, reason)
			if tt.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

type settingsPermissionAccessControl struct {
	accesscontrol.AccessControl
	permissions map[string][]string
}

func (a settingsPermissionAccessControl) Evaluate(_ context.Context, _ identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return evaluator.Evaluate(a.permissions), nil
}

func TestGetAuthorizerPermissions(t *testing.T) {
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{UserID: 1, OrgID: 1})
	for _, tc := range []struct {
		name                         string
		permissions                  map[string][]string
		readOnly, missingWriteAccess bool
		appDecision, writeDecision   authorizer.Decision
	}{
		{name: "app access", permissions: map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:test-app"}}, appDecision: authorizer.DecisionAllow, writeDecision: authorizer.DecisionDeny},
		{name: "settings write access", permissions: map[string][]string{pluginaccesscontrol.ActionWrite: {"plugins:id:test-app"}}, appDecision: authorizer.DecisionDeny, writeDecision: authorizer.DecisionAllow},
		{name: "another plugin", permissions: map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:other-app"}, pluginaccesscontrol.ActionWrite: {"plugins:id:other-app"}}, appDecision: authorizer.DecisionDeny, writeDecision: authorizer.DecisionDeny},
		{name: "read-only with write permission", permissions: map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:test-app"}, pluginaccesscontrol.ActionWrite: {"plugins:id:test-app"}}, readOnly: true, appDecision: authorizer.DecisionAllow, writeDecision: authorizer.DecisionDeny},
		{name: "missing write access control", permissions: map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:test-app"}, pluginaccesscontrol.ActionWrite: {"plugins:id:test-app"}}, missingWriteAccess: true, appDecision: authorizer.DecisionAllow, writeDecision: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ac := settingsPermissionAccessControl{permissions: tc.permissions}
			opts := Options{AccessControl: ac, ReadOnly: tc.readOnly}
			if tc.missingWriteAccess {
				opts.AccessControl = nil
			}
			auth := newSettingsAuthorizer("test-app", pluginaccesscontrol.NewAppAccessChecker(ac), opts)
			for _, verb := range []string{"create", "update", "patch", "delete", "deletecollection"} {
				decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{Verb: verb, Resource: "app", Name: "instance", ResourceRequest: true})
				require.NoError(t, err)
				require.Equal(t, tc.writeDecision, decision, "%s settings", verb)
			}
			for _, attr := range []authorizer.AttributesRecord{
				{Verb: "get", Resource: "app", Name: "instance", ResourceRequest: true},
				{Verb: "list", Resource: "app", ResourceRequest: true},
				{Verb: "get", Resource: "app", Subresource: "health", Name: "instance", ResourceRequest: true},
				{Verb: "create", Resource: "app", Subresource: "resources", Name: "instance", ResourceRequest: true},
				{Verb: "create", Resource: "app", Subresource: "proxy", Name: "instance", ResourceRequest: true},
			} {
				decision, _, err := auth.Authorize(ctx, attr)
				require.NoError(t, err)
				require.Equal(t, tc.appDecision, decision, "%s %s", attr.Verb, attr.Subresource)
			}
			decision, _, err := auth.Authorize(t.Context(), authorizer.AttributesRecord{Verb: "get"})
			require.Error(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision, "discovery still requires a requester")
		})
	}
}

func TestNewBuilderChecksSettingsWritesWithAccessControl(t *testing.T) {
	plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "test-app"}}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	ac := &actest.FakeAccessControl{ExpectedEvaluate: false}
	b, err := NewBuilder(plugin, struct{ PluginClient }{}, struct{ PluginContextWrapper }{}, nil,
		func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		}, Options{AccessControl: ac}, nil, nil)
	require.NoError(t, err)
	decision, _, err := b.GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{Verb: "update", Resource: "app", Name: "instance", ResourceRequest: true})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)

	ac.ExpectedEvaluate = true
	decision, _, err = b.GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{Verb: "update", Resource: "app", Name: "instance", ResourceRequest: true})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
}
