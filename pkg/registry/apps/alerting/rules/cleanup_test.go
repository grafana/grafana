package rules

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	alertvalidation "github.com/grafana/grafana/apps/alerting/rules/pkg/app/alertrule"
	appconfig "github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	recordingvalidation "github.com/grafana/grafana/apps/alerting/rules/pkg/app/recordingrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/user"
)

type cleanupMembershipResolver func(context.Context, []string) (map[string]appconfig.RuleSequenceMembership, error)

func (f cleanupMembershipResolver) Resolve(ctx context.Context, uids []string) (map[string]appconfig.RuleSequenceMembership, error) {
	return f(ctx, uids)
}

type cleanupAccessControl struct {
	actest.FakeAccessControl
	scopes []string
}

func (a cleanupAccessControl) Evaluate(_ context.Context, _ identity.Requester, ev accesscontrol.Evaluator) (bool, error) {
	return ev.Evaluate(map[string][]string{accesscontrol.ActionAlertingRuleDelete: a.scopes}), a.ExpectedErr
}

func TestSequenceMemberCollectionDeletion(t *testing.T) {
	for _, kind := range []struct {
		resource string
		validate func(context.Context, appconfig.RuntimeConfig) error
	}{
		{"alertrules", func(ctx context.Context, cfg appconfig.RuntimeConfig) error {
			return alertvalidation.ValidateDelete(cfg)(ctx, validation.Request[*model.AlertRule]{OldObject: &model.AlertRule{ObjectMeta: metav1.ObjectMeta{Name: "member"}}})
		}},
		{"recordingrules", func(ctx context.Context, cfg appconfig.RuntimeConfig) error {
			return recordingvalidation.ValidateDelete(cfg)(ctx, validation.Request[*model.RecordingRule]{OldObject: &model.RecordingRule{ObjectMeta: metav1.ObjectMeta{Name: "member"}}})
		}},
	} {
		t.Run(kind.resource, func(t *testing.T) {
			for _, tc := range []struct {
				name          string
				mutate        func(*apirequest.RequestInfo)
				human         bool
				missingUser   bool
				missingInfo   bool
				namespace     string
				scopes        []string
				authErr       error
				membershipErr error
				wantErr       string
				wantResolve   bool
			}{
				{name: "org cleanup tolerates stale membership", scopes: []string{"*"}},
				{name: "ordinary single deletion remains blocked", scopes: []string{"*"}, mutate: func(i *apirequest.RequestInfo) { i.Verb = "delete"; i.Name = "member" }, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "human collection deletion remains blocked", human: true, scopes: []string{"*"}, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "missing identity remains blocked", missingUser: true, scopes: []string{"*"}, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "missing request metadata remains blocked", missingInfo: true, scopes: []string{"*"}, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "missing delete permission remains blocked", wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "folder delete permission insufficient", scopes: []string{"folders:uid:f1"}, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "cross org deletion rejected", namespace: "org-2", scopes: []string{"*"}, wantErr: "namespace"},
				{name: "all namespaces deletion rejected", namespace: "*", scopes: []string{"*"}, wantErr: "namespace"},
				{name: "request namespace mismatch rejected", scopes: []string{"*"}, mutate: func(i *apirequest.RequestInfo) { i.Namespace = "org-2" }, wantErr: "request namespace mismatch"},
				{name: "other API group cannot bypass membership", scopes: []string{"*"}, mutate: func(i *apirequest.RequestInfo) { i.APIGroup = "other.example" }, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "subresource cannot bypass membership", scopes: []string{"*"}, mutate: func(i *apirequest.RequestInfo) { i.Subresource = "status" }, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "non resource cannot bypass membership", scopes: []string{"*"}, mutate: func(i *apirequest.RequestInfo) { i.IsResourceRequest = false }, wantErr: "belongs to rule sequence", wantResolve: true},
				{name: "authorization failure fails closed", scopes: []string{"*"}, authErr: errors.New("authorization unavailable"), wantErr: "authorization unavailable"},
				{name: "membership failure is surfaced", membershipErr: errors.New("index unavailable"), wantErr: "index unavailable", wantResolve: true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					namespace := tc.namespace
					if namespace == "" {
						namespace = "default"
					}
					ctx := apirequest.WithNamespace(context.Background(), namespace)
					if tc.human {
						ctx = identity.WithRequester(ctx, &user.SignedInUser{UserID: 1, OrgID: 1})
					} else if !tc.missingUser {
						ctx = identity.WithServiceIdentityContext(ctx, 1)
					}
					info := &apirequest.RequestInfo{IsResourceRequest: true, Verb: "deletecollection", APIGroup: model.APIGroup, Resource: kind.resource, Namespace: namespace}
					if tc.mutate != nil {
						tc.mutate(info)
					}
					if !tc.missingInfo {
						ctx = apirequest.WithRequestInfo(ctx, info)
					}
					resolved := false
					cfg := appconfig.RuntimeConfig{
						AllowDeletingSequenceMembers: newSequenceMemberDeletionAuthorizer(cleanupAccessControl{scopes: tc.scopes, FakeAccessControl: actest.FakeAccessControl{ExpectedErr: tc.authErr}}),
						MembershipResolver: cleanupMembershipResolver(func(context.Context, []string) (map[string]appconfig.RuleSequenceMembership, error) {
							resolved = true
							return map[string]appconfig.RuleSequenceMembership{"member": {Found: true, SequenceUID: "stale-sequence"}}, tc.membershipErr
						}),
					}
					err := kind.validate(ctx, cfg)
					if tc.wantErr == "" {
						require.NoError(t, err)
					} else {
						require.ErrorContains(t, err, tc.wantErr)
					}
					require.Equal(t, tc.wantResolve, resolved)
				})
			}
		})
	}
}
