package test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	acmig "github.com/grafana/grafana/pkg/services/sqlstore/migrations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const managedRoutesPermissionsMigrationID = "grant basic roles access to default notification policy"

// TestManagedRoutesPermissionsMigration_ManyOrgs reproduces issue #124016.
// With enough managed editor/viewer roles (one pair per org), the bulk
// InsertMulti exceeds SQLite's SQLITE_MAX_VARIABLE_NUMBER (32766 in modernc),
// failing with "too many SQL variables (1)".
func TestManagedRoutesPermissionsMigration_ManyOrgs(t *testing.T) {
	x := setupTestDB(t)

	// Drop the migration log entry so we can re-run the migration on top of
	// a fully populated role table.
	_, err := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, managedRoutesPermissionsMigrationID)
	require.NoError(t, err)

	// Seed managed editor + viewer roles across many orgs. Need enough orgs
	// so that 4 permissions/org * 9 columns/permission > 32766.
	// 1000 orgs -> 4000 permissions -> 36000 placeholders, well over the limit.
	const orgCount = 1000

	editorRoleName := accesscontrol.ManagedBuiltInRoleName(string(org.RoleEditor))
	viewerRoleName := accesscontrol.ManagedBuiltInRoleName(string(org.RoleViewer))

	roles := make([]accesscontrol.Role, 0, orgCount*2)
	for i := int64(1); i <= orgCount; i++ {
		roles = append(roles,
			accesscontrol.Role{OrgID: i, Version: 1, UID: fmt.Sprintf("managed_%d_editor", i), Name: editorRoleName, Updated: now, Created: now},
			accesscontrol.Role{OrgID: i, Version: 1, UID: fmt.Sprintf("managed_%d_viewer", i), Name: viewerRoleName, Updated: now, Created: now},
		)
	}
	// Insert in chunks small enough to stay under the SQLite variable limit
	// (Role has fewer columns than Permission, but be safe).
	const chunk = 500
	for i := 0; i < len(roles); i += chunk {
		end := min(i+chunk, len(roles))
		_, err := x.Insert(roles[i:end])
		require.NoError(t, err)
	}

	// Run only the failing migration on the prepared DB.
	mg := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("acmigration.test")})
	acmig.AddManagedRoutesPermissions(mg)
	require.NoError(t, mg.Start(false, 0))

	// Verify all expected permissions were created.
	scope := models.ScopeRoutesProvider.GetResourceScopeUID(models.DefaultRoutingTreeName)
	count, err := x.Table("permission").Where("scope = ?", scope).Count(&accesscontrol.Permission{})
	require.NoError(t, err)
	// 1 viewer action + 3 editor actions per org.
	require.Equal(t, int64(orgCount*4), count)
}
