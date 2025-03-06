//go:build enterprise || pro

package migrations

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	"xorm.io/core"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
)

func setupTestDB(t *testing.T) (*migrator.Migrator, *xorm.Engine) {
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
	migrations := &OSSMigrations{}
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	return mg, x
}

// This "test" migrates database from scratch, and then generates Spanner DDL statements for re-creating the same database.
func TestMigrateToSpannerDialect(t *testing.T) {
	mg, eng := setupTestDB(t)
	tables, err := eng.DBMetas()
	require.NoError(t, err)

	var statements []string

	spannerDialect := migrator.NewSpannerDialect()
	for _, table := range tables {
		t := &migrator.Table{
			Name:        table.Name,
			Columns:     nil,
			PrimaryKeys: table.PrimaryKeys,
			Indices:     nil,
		}

		for _, c := range table.Columns() {
			col := &migrator.Column{
				Name:            c.Name,
				Type:            c.SQLType.Name,
				Length:          c.Length,
				Length2:         c.Length2,
				Nullable:        c.Nullable,
				IsPrimaryKey:    c.IsPrimaryKey,
				IsAutoIncrement: c.IsAutoIncrement,
				IsLatin:         false,
				Default:         c.Default,
			}
			if (col.Type == core.Bool || col.Type == core.TinyInt) && c.Default != "" {
				b, err := strconv.ParseBool(c.Default)
				if err == nil {
					// Format bool values as true/false.
					col.Default = strconv.FormatBool(b)
				}
			}
			t.Columns = append(t.Columns, col)
		}

		for _, ix := range table.Indexes {
			nix := &migrator.Index{
				Name: ix.Name,
				Type: ix.Type,
				Cols: ix.Cols,
			}
			t.Indices = append(t.Indices, nix)
		}

		statements = append(statements, spannerDialect.CreateTableSQL(t))

		for _, nix := range t.Indices {
			if nix.Name != "PRIMARY_KEY" {
				statements = append(statements, spannerDialect.CreateIndexSQL(table.Name, nix))
			}
		}
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")

	require.NoError(t, enc.Encode(statements))
	fmt.Println()
	require.NoError(t, enc.Encode(mg.GetMigrationIDs(true)))
}
