package resourcepermission

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIntegrationSecureValueResourcePermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()
	backend := setupBackend(t)
	backend.mappers.RegisterMapper(
		schema.GroupResource{Group: "secret.grafana.app", Resource: "securevalues"},
		NewMapper("secret.securevalues", defaultLevels), nil,
	)
	backend.identityStore = NewFakeIdentityStore(t)
	db, err := backend.dbProvider(ctx)
	require.NoError(t, err)
	_, err = db.DB.GetSqlxSession().Exec(ctx,
		"INSERT INTO "+db.DB.GetDialect().Quote("user")+" (id, org_id, uid, login, email, is_admin, is_service_account, created, updated, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		101, 1, "captain", "captain", "captain@example.com", false, false, timeNow(), timeNow(), 0)
	require.NoError(t, err)
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	for _, name := range []string{"personal-one", "personal-two"} {
		rp := &iamv0.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{Name: "secret.grafana.app-securevalues-" + name, Namespace: "default"},
			Spec: iamv0.ResourcePermissionSpec{
				Resource:    iamv0.ResourcePermissionspecResource{ApiGroup: "secret.grafana.app", Resource: "securevalues", Name: name},
				Permissions: []iamv0.ResourcePermissionspecPermission{{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "captain", Verb: "Edit"}},
			},
		}
		require.NoError(t, ValidateCreateAndUpdateInput(ctx, rp, backend.mappers))
		grn, err := splitResourceName(rp.Name)
		require.NoError(t, err)
		mapper, err := backend.getResourceMapper(grn.Group, grn.Resource)
		require.NoError(t, err)
		_, err = backend.createResourcePermission(ctx, db, ns, mapper, grn, rp)
		require.NoError(t, err)
		var stored *iamv0.ResourcePermission
		require.NoError(t, db.DB.GetSqlxSession().WithTransaction(ctx, func(tx *session.SessionTx) error {
			stored, err = backend.getResourcePermission(ctx, db, tx, ns, rp.Name)
			return err
		}))
		require.Equal(t, rp.Spec.Resource, stored.Spec.Resource)
		require.Equal(t, []iamv0.ResourcePermissionspecPermission{{Kind: iamv0.ResourcePermissionSpecPermissionKindUser, Name: "captain", Verb: "edit"}}, stored.Spec.Permissions)
	}
	var roles []string
	require.NoError(t, db.DB.GetSqlxSession().Select(ctx, &roles, "SELECT name FROM role WHERE org_id = ?", 1))
	require.Equal(t, []string{"managed:users:101:permissions"}, roles)
	var perms []accesscontrol.Permission
	require.NoError(t, db.DB.GetSqlxSession().Select(ctx, &perms, "SELECT action, scope FROM permission"))
	require.ElementsMatch(t, []accesscontrol.Permission{
		{Action: "secret.securevalues:edit", Scope: "secret.securevalues:uid:personal-one"},
		{Action: "secret.securevalues:edit", Scope: "secret.securevalues:uid:personal-two"},
	}, perms)
	require.NoError(t, backend.deleteResourcePermission(ctx, db, ns, "secret.grafana.app-securevalues-personal-one"))
	perms = nil
	require.NoError(t, db.DB.GetSqlxSession().Select(ctx, &perms, "SELECT action, scope FROM permission"))
	require.Equal(t, []accesscontrol.Permission{{Action: "secret.securevalues:edit", Scope: "secret.securevalues:uid:personal-two"}}, perms)
}
