package legacypermissions

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationRemotePermissionStoreTenantIsolation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t, db.WithoutMigrator(), db.WithoutDefaultOrgAndUser())
	// SQLite attachments belong to one connection. MySQL/Postgres exercise
	// qualified queries through a shared pool with several connections.
	if db.IsTestDbSQLite() {
		database.GetEngine().DB().SetMaxOpenConns(1)
		database.GetEngine().DB().SetMaxIdleConns(1)
	} else {
		database.GetEngine().DB().SetMaxOpenConns(4)
	}
	session := database.GetSqlxSession()
	dialect := sqltemplate.DialectForDriver(string(database.GetDBType()))
	qualified := func(schema, table string) string {
		if schema != "" {
			table = schema + "." + table
		}
		name, err := dialect.Ident(table)
		require.NoError(t, err)
		return name
	}
	schemas := map[string]string{}
	for i, namespace := range []string{"stacks-101", "stacks-202"} {
		schema := "authz_" + strconv.FormatInt(time.Now().UnixNano(), 36) + strconv.Itoa(i)
		schemas[namespace] = schema
		name := qualified("", schema)
		var create, drop string
		switch {
		case db.IsTestDbSQLite():
			create = "ATTACH DATABASE ':memory:' AS " + name
			drop = "DETACH DATABASE " + name
		case db.IsTestDbMySQL():
			create = "CREATE DATABASE " + name
			drop = "DROP DATABASE " + name
		case db.IsTestDbPostgres():
			create = "CREATE SCHEMA " + name
			drop = "DROP SCHEMA " + name + " CASCADE"
		default:
			t.Skip("tenant isolation fixture requires SQLite, MySQL, or PostgreSQL")
		}
		_, err := session.Exec(t.Context(), create)
		require.NoError(t, err)
		t.Cleanup(func() { _, err := session.Exec(context.Background(), drop); require.NoError(t, err) })
	}
	seed := func(schema, scope string, roleID int) {
		for table, columns := range map[string]string{
			"permission":   "action TEXT, scope TEXT, role_id BIGINT, kind TEXT",
			"role":         "id BIGINT, name TEXT",
			"user_role":    "user_id BIGINT, role_id BIGINT, org_id BIGINT",
			"team_role":    "team_id BIGINT, role_id BIGINT, org_id BIGINT",
			"builtin_role": "role TEXT, role_id BIGINT, org_id BIGINT",
		} {
			_, err := session.Exec(t.Context(), "CREATE TABLE "+qualified(schema, table)+" ("+columns+")")
			require.NoError(t, err)
		}
		for _, item := range []struct {
			table, values string
			args          []any
		}{
			{"permission", "?, ?, ?, ?", []any{"users:read", scope, roleID, "users"}},
			{"role", "?, ?", []any{roleID, "custom:reader"}},
			{"user_role", "?, ?, ?", []any{7, roleID, 0}},
			{"team_role", "?, ?, ?", []any{11, roleID, 1}},
			{"builtin_role", "?, ?, ?", []any{"Viewer", roleID, 0}},
		} {
			_, err := session.Exec(t.Context(), "INSERT INTO "+qualified(schema, item.table)+" VALUES ("+item.values+")", item.args...)
			require.NoError(t, err)
		}
	}
	// A missed qualifier either reads the decoy grant or loses a tenant grant.
	seed("", "wrong-default-schema", 99)
	for namespace, schema := range schemas {
		seed(schema, namespace, 1)
	}
	store := remotePermissionStore{database: func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		namespace, _ := request.NamespaceFrom(ctx)
		schema, ok := schemas[namespace]
		if !ok {
			return nil, fmt.Errorf("unknown test tenant")
		}
		return &legacysql.LegacyDatabaseHelper{DB: database, Table: func(table string) string { return schema + "." + table }}, nil
	}}
	check := func(namespace string) error {
		ctx := request.WithNamespace(t.Context(), namespace)
		for _, query := range []ac.GetUserPermissionsQuery{
			{OrgID: 1, UserID: 7},
			{OrgID: 1, TeamIDs: []int64{11}},
			{OrgID: 1, Roles: []string{"Viewer"}},
			{OrgID: 1, UserID: 7, TeamIDs: []int64{11}, Roles: []string{"Viewer"}},
			{OrgID: 0, UserID: 7, Roles: []string{"Viewer"}},
			{OrgID: -1, UserID: 7},
		} {
			for _, actions := range [][]string{nil, {"users:read"}} {
				got, err := store.permissionsForActions(ctx, query, actions)
				if err != nil {
					return err
				}
				if len(got) != 1 || got[0].Action != "users:read" || got[0].Scope != namespace {
					return fmt.Errorf("tenant %s received permissions %v", namespace, got)
				}
			}
		}
		got, err := store.teams(ctx, ac.GetUserPermissionsQuery{OrgID: 1, TeamIDs: []int64{11}})
		if err != nil {
			return err
		}
		if len(got) != 1 || len(got[11]) != 1 || got[11][0].Scope != namespace {
			return fmt.Errorf("tenant %s received team permissions %v", namespace, got)
		}
		return nil
	}
	for _, namespace := range []string{"stacks-101", "stacks-202", "stacks-101"} {
		require.NoError(t, check(namespace))
	}
	var wg sync.WaitGroup
	errors := make(chan error, 20)
	for i := 0; i < 10; i++ {
		for namespace := range schemas {
			wg.Go(func() { errors <- check(namespace) })
		}
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	for _, ctx := range []context.Context{t.Context(), request.WithNamespace(t.Context(), "stacks-999")} {
		got, err := store.permissions(ctx, ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7})
		require.Error(t, err)
		require.Nil(t, got)
	}
}
