package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// Setup users
var (
	now = time.Now()

	users = []user.User{
		{
			ID:      1,
			UID:     "u1",
			Email:   "viewer1@example.org",
			Name:    "viewer1",
			Login:   "viewer1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      2,
			UID:     "u2",
			Email:   "viewer2@example.org",
			Name:    "viewer2",
			Login:   "viewer2",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      3,
			UID:     "u3",
			Email:   "editor1@example.org",
			Name:    "editor1",
			Login:   "editor1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:      4,
			UID:     "u4",
			Email:   "admin1@example.org",
			Name:    "admin1",
			Login:   "admin1",
			OrgID:   1,
			Created: now,
			Updated: now,
		},
		{
			ID:    5,
			UID:   "u5",
			Email: "editor2@example.org",
			Name:  "editor2",
			Login: "editor2",
			OrgID: 2,
		},
	}
)

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
			fmt.Printf("failed to close xorm engine: %v", err)
		}
	})

	err = migrator.NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := migrator.NewMigrator(x, &setting.Cfg{
		Logger: log.New("users.test"),
		Raw:    ini.Empty(),
	})
	migrations := &migrations.OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return x
}
