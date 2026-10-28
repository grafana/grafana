package server

import (
	"context"
	"errors"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func TestIntegrationBindingRecipients(t *testing.T) {
	srv := setupOpenFGAServer(t)
	tuples, err := zanzana.ConvertRolePermissionsToTuples("assigner", []zanzana.RolePermission{
		{Action: "users.roles:add", Kind: "permissions", Identifier: "delegate"},
		{Action: "teams.roles:remove", Kind: "permissions", Identifier: "delegate"},
	})
	require.NoError(t, err)
	tuples = append(tuples, &openfgav1.TupleKey{User: "user:1", Relation: "assignee", Object: "role:assigner"})
	setupOpenFGADatabase(t, srv, tuples)
	for _, tc := range []struct {
		name, verb string
		want       bool
	}{
		{"user-a", "create", true}, {"serviceaccount-a", "update", true}, {"team-a", "create", false},
		{"user-*", "update", true}, {"serviceaccount-*", "create", true}, {"team-*", "delete", true},
		{"user-a", "delete", false}, {"team-a", "delete", true}, {"", "create", true},
		{"*", "update", false}, {"", "update", false}, {"user-", "create", false}, {"team-a*", "delete", false},
	} {
		t.Run(tc.name+"/"+tc.verb, func(t *testing.T) {
			requireCheckAndBatchDecision(t, srv, &authzv1.CheckRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: tc.verb, Name: tc.name}, tc.want)
		})
	}
	res, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "update"})
	require.NoError(t, err)
	require.False(t, res.GetAll())
	// Grants in this namespace must not authorize a different namespace.
	other, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{Namespace: "org-other", Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "create", Name: "user-a"})
	require.NoError(t, err)
	require.False(t, other.GetAllowed())
	store, err := srv.getStoreInfo(newContextWithNamespace(), namespace)
	require.NoError(t, err)
	_, err = srv.openFGAClient.Write(newContextWithNamespace(), &openfgav1.WriteRequest{StoreId: store.ID, AuthorizationModelId: store.ModelID, Deletes: &openfgav1.WriteRequestDeletes{TupleKeys: []*openfgav1.TupleKeyWithoutCondition{{User: "user:1", Relation: "assignee", Object: "role:assigner"}}}})
	require.NoError(t, err)
	requireCheckAndBatchDecision(t, srv, &authzv1.CheckRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "create", Name: "user-a"}, false)

}

func TestIntegrationBindingNativeAuthority(t *testing.T) {
	srv := setupOpenFGAServer(t)
	setupOpenFGADatabase(t, srv, []*openfgav1.TupleKey{{User: "user:1", Relation: "create", Object: "group_resource:iam.grafana.app/rolebindings"}})
	for _, tc := range []struct {
		name, verb string
		want       bool
	}{
		{"user-a", "create", true}, {"team-a", "create", true}, {"*", "create", true},
		{"user-*", "create", true}, {"team-*", "create", true}, {"serviceaccount-*", "create", true},
		{"user-a", "update", false}, {"user-a*", "create", false}, {"invalid", "create", false},
	} {
		t.Run(tc.name+"/"+tc.verb, func(t *testing.T) {
			requireCheckAndBatchDecision(t, srv, &authzv1.CheckRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: tc.verb, Name: tc.name}, tc.want)
		})
	}
}

type bindingListReconciler struct {
	ensure func(context.Context, string) error
}

func (r bindingListReconciler) Run(context.Context) error { return nil }
func (r bindingListReconciler) EnsureNamespace(ctx context.Context, namespace string) error {
	return r.ensure(ctx, namespace)
}

func TestIntegrationBindingListReconcilesBeforeChecking(t *testing.T) {
	for _, family := range []string{"users", "teams"} {
		for _, verb := range []string{"create", "update", "delete"} {
			t.Run(family+"/"+verb, func(t *testing.T) {
				srv := setupOpenFGAServer(t)
				broad := &openfgav1.TupleKey{User: "user:1", Relation: verb, Object: "group_resource:iam.grafana.app/rolebindings"}
				setupOpenFGADatabase(t, srv, []*openfgav1.TupleKey{broad})
				calls := 0
				srv.mtReconciler = bindingListReconciler{ensure: func(ctx context.Context, ns string) error {
					calls++
					require.Equal(t, namespace, ns)
					store, err := srv.getStoreInfo(ctx, ns)
					if err != nil {
						return err
					}
					_, err = srv.openFGAClient.Write(ctx, &openfgav1.WriteRequest{StoreId: store.ID, AuthorizationModelId: store.ModelID,
						Deletes: &openfgav1.WriteRequestDeletes{TupleKeys: []*openfgav1.TupleKeyWithoutCondition{{User: broad.User, Relation: broad.Relation, Object: broad.Object}}},
						Writes:  &openfgav1.WriteRequestWrites{TupleKeys: []*openfgav1.TupleKey{{User: broad.User, Relation: broad.Relation, Object: broad.Object + "/" + family}}},
					})
					return err
				}}
				res, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: verb})
				require.NoError(t, err)
				require.Equal(t, 1, calls)
				require.False(t, res.GetAll())
			})
		}
	}
}

func TestIntegrationBindingListFailsClosedOnReconciliationError(t *testing.T) {
	srv := setupOpenFGAServer(t)
	setupOpenFGADatabase(t, srv, []*openfgav1.TupleKey{{User: "user:1", Relation: "update", Object: "group_resource:iam.grafana.app/rolebindings"}})
	srv.mtReconciler = bindingListReconciler{ensure: func(context.Context, string) error { return errors.New("reconciliation unavailable") }}
	res, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "update"})
	require.Error(t, err)
	require.Nil(t, res)
	// Read queries retain their existing path.
	_, err = srv.List(newContextWithNamespace(), &authzv1.ListRequest{Namespace: namespace, Subject: "user:1", Group: "iam.grafana.app", Resource: "rolebindings", Verb: "list"})
	require.NoError(t, err)
}
