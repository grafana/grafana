package test

import (
	"fmt"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const (
	receiverUIDPermissionsMigrationID = "copy receiver permissions to the uids of receivers"

	actionReceiverRead   = accesscontrol.ActionAlertingReceiversRead
	actionReceiverUpdate = accesscontrol.ActionAlertingReceiversUpdate
)

// receiverNames covers identifiers that are used as they are and ones that are hashed, as their UID is longer than 40
// characters, around that boundary.
var receiverNames = map[string]string{
	"short":           "contact-point",
	"unicode":         "контакт",
	"40 characters":   strings.Repeat("n", 30),
	"42 characters":   strings.Repeat("n", 31),
	"long":            strings.Repeat("a long name ", 10),
	"with whitespace": " Mixed Case / and symbols?",
}

// previousScope is the scope that permissions to the receiver had when its UID was derived from its name.
func previousScope(name string) string {
	return models.ScopeReceiversProvider.GetResourceScopeUID(models.NameToUid(name))
}

// currentScope is the scope that permissions to a receiver without a persisted UID are looked up by.
func currentScope(name string) string {
	return models.ScopeReceiversProvider.GetResourceScopeUID(string(v1.ReceiverUID(name)))
}

func runReceiverUIDPermissionsMigration(t *testing.T, x *xorm.Engine) {
	t.Helper()
	// The migration already ran against the empty database that the test was set up with.
	_, err := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, receiverUIDPermissionsMigrationID)
	require.NoError(t, err)
	mg := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("acmigration.test")})
	acmig.AddReceiverUIDPermissionsMigration(mg)
	require.NoError(t, mg.Start(false, 0))
}

func seedReceiverRole(t *testing.T, x *xorm.Engine, orgID int64, uid string) int64 {
	t.Helper()
	role := accesscontrol.Role{OrgID: orgID, Version: 1, UID: uid, Name: "managed:users:" + uid + ":permissions", Created: now, Updated: now}
	_, err := x.Insert(&role)
	require.NoError(t, err)
	return role.ID
}

func seedReceiverPermission(t *testing.T, x *xorm.Engine, roleID int64, action, scope string) {
	t.Helper()
	kind, attribute, identifier := accesscontrol.SplitScope(scope)
	_, err := x.Insert(&accesscontrol.Permission{RoleID: roleID, Action: action, Scope: scope, Kind: kind, Attribute: attribute, Identifier: identifier, Created: now, Updated: now})
	require.NoError(t, err)
}

// scopesOf returns, by action, the scopes of the permissions of the role.
func scopesOf(t *testing.T, x *xorm.Engine, roleID int64) map[string][]string {
	t.Helper()
	var permissions []accesscontrol.Permission
	require.NoError(t, x.Where("role_id = ?", roleID).Find(&permissions))
	scopes := make(map[string][]string)
	for _, p := range permissions {
		scopes[p.Action] = append(scopes[p.Action], p.Scope)
	}
	return scopes
}

func TestReceiverUIDPermissionsMigration_CopiesPermissions(t *testing.T) {
	x := setupTestDB(t)

	names := make([]string, 0, len(receiverNames))
	for _, name := range receiverNames {
		names = append(names, name)
	}
	roleID := seedReceiverRole(t, x, 1, "role")
	for _, name := range names {
		seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope(name))
		seedReceiverPermission(t, x, roleID, actionReceiverUpdate, previousScope(name))
	}

	runReceiverUIDPermissionsMigration(t, x)

	for description, name := range receiverNames {
		t.Run(description, func(t *testing.T) {
			var permissions []accesscontrol.Permission
			require.NoError(t, x.Where("role_id = ? AND scope = ?", roleID, currentScope(name)).OrderBy("action").Find(&permissions))
			require.Len(t, permissions, 2)
			identifier := strings.TrimPrefix(currentScope(name), "receivers:uid:")
			for i, action := range []string{actionReceiverRead, actionReceiverUpdate} {
				require.Equal(t, action, permissions[i].Action)
				require.Equal(t, "receivers", permissions[i].Kind)
				require.Equal(t, "uid", permissions[i].Attribute)
				require.Equal(t, identifier, permissions[i].Identifier)
			}
		})
	}
	// The previous permissions are kept.
	require.Len(t, scopesOf(t, x, roleID)[actionReceiverRead], 2*len(names))
	require.Len(t, scopesOf(t, x, roleID)[actionReceiverUpdate], 2*len(names))
	for _, name := range names {
		require.Contains(t, scopesOf(t, x, roleID)[actionReceiverRead], previousScope(name))
	}
}

func TestReceiverUIDPermissionsMigration_LeavesOtherPermissionsAlone(t *testing.T) {
	x := setupTestDB(t)
	roleID := seedReceiverRole(t, x, 1, "role")
	scopes := []string{
		"receivers:uid:*",
		"receivers:uid:-",
		"folders:uid:" + strings.TrimPrefix(previousScope("a"), "receivers:uid:"),
	}
	for _, scope := range scopes {
		seedReceiverPermission(t, x, roleID, actionReceiverRead, scope)
	}
	seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope("a"))

	runReceiverUIDPermissionsMigration(t, x)

	require.ElementsMatch(t, slices.Concat(scopes, []string{previousScope("a"), currentScope("a")}), scopesOf(t, x, roleID)[actionReceiverRead])
}

// The receivers that the permissions are for are not looked up, so those of every role are copied, including the ones
// for receivers that do not exist any more.
func TestReceiverUIDPermissionsMigration_CopiesPermissionsOfEveryRole(t *testing.T) {
	x := setupTestDB(t)
	roles := []int64{seedReceiverRole(t, x, 1, "org1"), seedReceiverRole(t, x, 2, "org2"), seedReceiverRole(t, x, 0, "global")}
	for _, roleID := range roles {
		seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope("a"))
	}

	runReceiverUIDPermissionsMigration(t, x)

	for _, roleID := range roles {
		require.ElementsMatch(t, []string{previousScope("a"), currentScope("a")}, scopesOf(t, x, roleID)[actionReceiverRead])
	}
}

// A permission that the new scope already has is not added again. A migration that is not recorded as done is not
// run again, so the permissions that it added are not taken for previous ones.
func TestReceiverUIDPermissionsMigration_SkipsExistingPermissions(t *testing.T) {
	x := setupTestDB(t)
	roleID := seedReceiverRole(t, x, 1, "role")
	seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope("a"))
	seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope("b"))
	// The permission to one of them was already added.
	seedReceiverPermission(t, x, roleID, actionReceiverRead, currentScope("b"))
	seedReceiverPermission(t, x, roleID, actionReceiverUpdate, previousScope("a"))

	runReceiverUIDPermissionsMigration(t, x)

	scopes := scopesOf(t, x, roleID)
	require.Contains(t, scopes[actionReceiverRead], currentScope("a"))
	require.Contains(t, scopes[actionReceiverRead], currentScope("b"))
	require.Equal(t, []string{previousScope("a"), currentScope("a")}, scopes[actionReceiverUpdate])
	count, err := x.Table("permission").Where("role_id = ? AND scope = ?", roleID, currentScope("b")).Count(&accesscontrol.Permission{})
	require.NoError(t, err)
	require.Equal(t, int64(1), count)
}

func TestReceiverUIDPermissionsMigration_NothingToMigrate(t *testing.T) {
	x := setupTestDB(t)
	roleID := seedReceiverRole(t, x, 1, "role")
	seedReceiverPermission(t, x, roleID, actionReceiverRead, "receivers:uid:*")

	runReceiverUIDPermissionsMigration(t, x)

	require.Equal(t, []string{"receivers:uid:*"}, scopesOf(t, x, roleID)[actionReceiverRead])
}

// More permissions than fit in a single insert, and than SQLite allows variables for.
func TestReceiverUIDPermissionsMigration_ManyPermissions(t *testing.T) {
	x := setupTestDB(t)
	const roles = 1200
	for i := range roles {
		roleID := seedReceiverRole(t, x, 1, fmt.Sprintf("role-%d", i))
		seedReceiverPermission(t, x, roleID, actionReceiverRead, previousScope("a"))
	}

	runReceiverUIDPermissionsMigration(t, x)

	count, err := x.Table("permission").Where("scope = ?", currentScope("a")).Count(&accesscontrol.Permission{})
	require.NoError(t, err)
	require.Equal(t, int64(roles), count)
}
