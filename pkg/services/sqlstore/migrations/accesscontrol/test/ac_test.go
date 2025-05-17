package test

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

type rawPermission struct {
	Action, Scope string
}

func (rp *rawPermission) toPermission(roleID int64, ts time.Time) accesscontrol.Permission {
	return accesscontrol.Permission{
		RoleID:  roleID,
		Action:  rp.Action,
		Scope:   rp.Scope,
		Updated: ts,
		Created: ts,
	}
}

// Setup users
var (
	now = time.Now()
)

func convertToRawPermissions(permissions []accesscontrol.Permission) []rawPermission {
	raw := make([]rawPermission, len(permissions))
	for i, p := range permissions {
		raw[i] = rawPermission{Action: p.Action, Scope: p.Scope}
	}
	return raw
}

func setupTestDB(t *testing.T) *xorm.Engine {
	t.Helper()
	dbType := sqlutil.GetTestDBType()
	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	err = migrator.NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{
		Logger: log.New("acmigration.test"),
		Raw:    ini.Empty(),
	})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}
