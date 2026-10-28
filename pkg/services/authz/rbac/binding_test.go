package rbac

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestBindingRecipientCheckAndBatch(t *testing.T) {
	for _, family := range []string{"users", "teams"} {
		for _, name := range []string{"user-a", "serviceaccount-a", "team-a", "user-*", "serviceaccount-*", "team-*", "*", "", "user-", "team-a*"} {
			for _, verb := range []string{"create", "update", "patch", "delete"} {
				t.Run(family+"/"+name+"/"+verb, func(t *testing.T) {
					s := setupService()
					ctx := types.WithAuthInfo(context.Background(), &identity.StaticRequester{Namespace: "org-12"})
					st := &fakeStore{userID: &store.UserIdentifiers{UID: "test-uid", ID: 1}, userPermissions: []accesscontrol.Permission{{Action: family + ".roles:add", Scope: "permissions:type:delegate"}}}
					s.store = st
					s.permissionStore = st
					s.identityStore = &fakeIdentityStore{}
					want := verb != "delete" && (name == "" && verb == "create" || family == "users" && (name == "user-a" || name == "serviceaccount-a" || name == "user-*" || name == "serviceaccount-*") || family == "teams" && (name == "team-a" || name == "team-*"))
					req := &authzv1.CheckRequest{Namespace: "org-12", Subject: "user:test-uid", Group: "iam.grafana.app", Resource: "rolebindings", Verb: verb, Name: name}
					res, err := s.Check(ctx, req)
					require.NoError(t, err)
					require.Equal(t, want, res.GetAllowed())
					batch, err := s.BatchCheck(ctx, &authzv1.BatchCheckRequest{Namespace: req.Namespace, Subject: req.Subject, Checks: []*authzv1.BatchCheckItem{{CorrelationId: "check", Group: req.Group, Resource: req.Resource, Verb: verb, Name: name}}})
					require.NoError(t, err)
					require.Empty(t, batch.Results["check"].GetError())
					require.Equal(t, want, batch.Results["check"].GetAllowed())
					list, err := s.List(ctx, &authzv1.ListRequest{Namespace: req.Namespace, Subject: req.Subject, Group: req.Group, Resource: req.Resource, Verb: verb})
					require.NoError(t, err)
					require.False(t, list.GetAll())
				})
			}
		}
	}
}

func TestBindingGrantRemovalAndNamespace(t *testing.T) {
	s := setupService()
	ctx := types.WithAuthInfo(context.Background(), &identity.StaticRequester{Namespace: "org-12"})
	st := &fakeStore{userID: &store.UserIdentifiers{UID: "test-uid", ID: 1}, userPermissions: []accesscontrol.Permission{
		{Action: "users.roles:remove", Scope: "permissions:type:delegate"},
		{Action: "teams.roles:remove", Scope: "permissions:type:delegate"},
	}}
	s.store = st
	s.permissionStore = st
	s.identityStore = &fakeIdentityStore{}
	req := &authzv1.CheckRequest{Namespace: "org-12", Subject: "user:test-uid", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "delete", Name: "*"}
	res, err := s.Check(ctx, req)
	require.NoError(t, err)
	require.True(t, res.GetAllowed())
	st.userPermissions = nil
	res, err = s.Check(ctx, req)
	require.NoError(t, err)
	require.False(t, res.GetAllowed())
	req.Namespace = "org-13"
	_, err = s.Check(ctx, req)
	require.Error(t, err)
}
