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
				accessChecker: pluginaccesscontrol.NewAppAccessChecker(&tt.fakeAC),
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

func TestGetAuthorizerSettingsWrites(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	allow := func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	}
	deny := func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
		return authorizer.DecisionDeny, "no", nil
	}
	settings := func(verb, subresource string) authorizer.AttributesRecord {
		return authorizer.AttributesRecord{Verb: verb, Resource: "app", Subresource: subresource, Name: "instance", ResourceRequest: true}
	}

	b := &Builder{pluginJSON: plugins.JSONData{ID: "test-app"}, accessChecker: allow, writeChecker: deny}
	for _, verb := range []string{"create", "update", "patch", "delete"} {
		decision, _, _ := b.GetAuthorizer().Authorize(ctx, settings(verb, ""))
		require.Equal(t, authorizer.DecisionDeny, decision, "%s needs the settings write permission", verb)
	}
	for _, attr := range []authorizer.AttributesRecord{settings("get", ""), settings("list", ""), settings("create", "resources"), settings("create", "proxy")} {
		decision, _, _ := b.GetAuthorizer().Authorize(ctx, attr)
		require.Equal(t, authorizer.DecisionAllow, decision, "%s %s needs app access only", attr.Verb, attr.Subresource)
	}

	b.writeChecker = allow
	decision, _, _ := b.GetAuthorizer().Authorize(ctx, settings("update", ""))
	require.Equal(t, authorizer.DecisionAllow, decision)

	b.writeChecker = nil
	decision, _, _ = b.GetAuthorizer().Authorize(ctx, settings("update", ""))
	require.Equal(t, authorizer.DecisionDeny, decision, "writes are refused without a write checker")
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
