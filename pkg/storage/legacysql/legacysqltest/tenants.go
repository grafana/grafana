// Package legacysqltest serves several tenants from one test database, each from its own schema,
// the way a multi-tenant legacysql.LegacyDatabaseProvider does. Code that misses a Table call, or
// quotes a schema-qualified name as a single identifier, reads or writes the wrong rows or fails.
package legacysqltest

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// Tenant is one tenant of a Tenants fixture.
type Tenant struct {
	Namespace string
	StackID   int64
	// Schema holds the tenant's copies of the fixture's tables.
	Schema string
}

// Context returns ctx carrying the tenant's namespace, which is how Tenants.Provider tells tenants
// apart.
func (t Tenant) Context(ctx context.Context) context.Context {
	return request.WithNamespace(ctx, t.Namespace)
}

type Tenants struct {
	DB      *sqlstore.SQLStore
	Tenants []Tenant
}

// New creates n tenant schemas on store, each holding empty copies of tables with the same columns,
// keys and indexes. store must already hold tables, so it must be migrated. The store's own tables
// stay in place: tests can seed them as decoys that no tenant should see.
//
// On SQLite the schemas are attached databases, which exist only on the connection that attached
// them, so New limits store to a single connection.
func New(tb testing.TB, store *sqlstore.SQLStore, n int, tables ...string) *Tenants {
	tb.Helper()
	ctx := context.Background()

	if db.IsTestDbSQLite() {
		store.GetEngine().DB().SetMaxOpenConns(1)
		store.GetEngine().DB().SetMaxIdleConns(1)
	}

	suffix := strconv.FormatInt(time.Now().UnixNano(), 36)
	fixture := &Tenants{DB: store}
	for i := range n {
		stackID := int64(1001 + i)
		tenant := Tenant{
			Namespace: fmt.Sprintf("stacks-%d", stackID),
			StackID:   stackID,
			Schema:    fmt.Sprintf("lsqlt_%s_%d", suffix, i),
		}
		createSchema(tb, ctx, store, tenant.Schema)
		for _, table := range tables {
			copyTable(tb, ctx, store, tenant.Schema, table)
		}
		fixture.Tenants = append(fixture.Tenants, tenant)
	}
	return fixture
}

// Provider resolves the tenant named by the namespace in ctx, like a multi-tenant provider. It fails
// when ctx has no namespace or names a tenant the fixture does not serve.
func (f *Tenants) Provider() legacysql.LegacyDatabaseProvider {
	return func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		ns, ok := request.NamespaceFrom(ctx)
		if !ok {
			return nil, fmt.Errorf("expecting namespace in context")
		}
		for _, t := range f.Tenants {
			if t.Namespace == ns {
				schema := t.Schema
				return &legacysql.LegacyDatabaseHelper{
					DB:      f.DB,
					Table:   func(n string) string { return schema + "." + n },
					StackID: t.StackID,
					Slug:    schema,
				}, nil
			}
		}
		return nil, fmt.Errorf("%w: %s", legacysql.ErrNamespaceNotFound, ns)
	}
}

func exec(tb testing.TB, ctx context.Context, store *sqlstore.SQLStore, query string) {
	tb.Helper()
	err := store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec(query)
		return err
	})
	require.NoError(tb, err, query)
}

func createSchema(tb testing.TB, ctx context.Context, store *sqlstore.SQLStore, schema string) {
	tb.Helper()
	name := store.Quote(schema)
	var create, drop string
	switch {
	case db.IsTestDbSQLite():
		create, drop = "ATTACH DATABASE ':memory:' AS "+name, "DETACH DATABASE "+name
	case db.IsTestDbMySQL():
		create, drop = "CREATE DATABASE "+name, "DROP DATABASE "+name
	case db.IsTestDbPostgres():
		create, drop = "CREATE SCHEMA "+name, "DROP SCHEMA "+name+" CASCADE"
	default:
		tb.Skip("legacysqltest requires SQLite, MySQL, or PostgreSQL")
	}
	exec(tb, ctx, store, create)
	tb.Cleanup(func() { exec(tb, context.Background(), store, drop) })
}

var (
	sqliteCreateTable = regexp.MustCompile("^CREATE TABLE\\s+[`\"\\[]?(\\w+)[`\"\\]]?")
	sqliteCreateIndex = regexp.MustCompile("^(CREATE (?:UNIQUE )?INDEX)\\s+[`\"\\[]?(\\w+)[`\"\\]]?\\s+ON")
)

func copyTable(tb testing.TB, ctx context.Context, store *sqlstore.SQLStore, schema, table string) {
	tb.Helper()
	target := store.Quote(schema + "." + table)
	switch {
	case db.IsTestDbMySQL():
		exec(tb, ctx, store, "CREATE TABLE "+target+" LIKE "+store.Quote(table))
		return
	case db.IsTestDbPostgres():
		// Columns keep their defaults, so ids come from the source table's sequence.
		exec(tb, ctx, store, "CREATE TABLE "+target+" (LIKE "+store.Quote(table)+" INCLUDING ALL)")
		return
	}

	// SQLite has no CREATE TABLE ... LIKE: replay the table's DDL inside the attached schema.
	var ddl []string
	err := store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL("SELECT sql FROM sqlite_master WHERE tbl_name = ? AND sql IS NOT NULL ORDER BY type DESC", table).Find(&ddl)
	})
	require.NoError(tb, err)
	require.NotEmpty(tb, ddl, "table %s not found", table)
	for _, stmt := range ddl {
		switch {
		case sqliteCreateTable.MatchString(stmt):
			stmt = sqliteCreateTable.ReplaceAllString(stmt, "CREATE TABLE "+target)
		case sqliteCreateIndex.MatchString(stmt):
			// An index is created in the schema its name is qualified with, on that schema's table.
			stmt = sqliteCreateIndex.ReplaceAllString(stmt, "$1 "+store.Quote(schema)+".`$2` ON")
		default:
			tb.Fatalf("unexpected DDL for table %s: %s", table, stmt)
		}
		exec(tb, ctx, store, stmt)
	}
}
