package migrator

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io"
	"strings"
	"text/template"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Package-level constants.
const (
	DefaultMigrationsLogTableName = "migrations_log"
	// MaxSupportedStringLength is the maximum value for N in VARCHAR(N) and
	// CHAR(N) column types. Use TEXT or BLOB data types if you need to store
	// longer text, and constrain it at the application level.
	MaxSupportedStringLength = 1023
)

var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").
			ParseFS(sqlTemplatesFS, `data/*.sql`))
)

var (
	tableCreateTmpl     = mustTemplate("table_create.sql")
	tableDropTmpl       = mustTemplate("table_drop.sql")
	columnAddTmpl       = mustTemplate("column_add.sql")
	columnDropTmpl      = mustTemplate("column_drop.sql")
	indexCreateTmpl     = mustTemplate("index_create.sql")
	indexDropTmpl       = mustTemplate("index_drop.sql")
	migrationsLogGet    = mustTemplate("migrations_log_get_last.sql")
	migrationsLogInsert = mustTemplate("migrations_log_insert.sql")
	checkIfATableExists = mustTemplate("check_if_a_table_exists.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Migrator runs migrations in a database. Migrations are ordered in steps, and
// each step runs in a separate transaction whenever supported by the database
// engine, and introducing a new database version. The first database version is
// zero, and is interpreted as the database not being initialized by the
// Migrator. Each successfully run migration step increments the database
// version by one.
//
// When transactions are not supported by the database engine, the
// implementation should be able to tell whether the system is currently in an
// intermediate state after a previously failed migration attempt (i.e. the
// databse is "dirty"), and refrain from taking any further action. In that
// case, manual operation will be required to either complete the previous
// migration or to roll it back in a sound manner. After the manual procedures,
// use the `Set`, `SetRecoveredToNext` or `SetRecoveredToPrev` methods to
// unblock further migrations.
//
// Note about support for DDL in transactions:
//   - SQLite does not support transactions at all. This means that a database
//     can be found to be dirty.
//   - PostgreSQL has full support for transactional DDL in all its supported
//     versions. This means that a database should never be found to be dirty,
//     providing the highest guarantees.
//   - MySQL with MyISAM has no support for transactions at all. With InnoDB it
//     supports transactions, but only for DML. Whenever a DDL statement is
//     found, it automatically commits any ongoing transaction. This means that
//     with MyISAM it's possible to have a dirty database in any migration,
//     while with InnoDB only pure data migations (with no DDL like creating,
//     altering or dropping tables or indexes) will be transactional, otherwise
//     it will still be possible to have a dirty database.
type Migrator interface {
	// Up migrates the database to the latest version. After a successful call
	// to Up, Current will return (Len(), false, nil).
	Up(context.Context) error
	// Down removes all migrations from the database. After a successful call to
	// Down, Current will return (0, false, nil).
	Down(context.Context) error

	// Len returns the number of migration steps.
	Len() int
	// Current returns the current migration version in the database.
	Current(context.Context) (version int, dirty bool, err error)

	// Set forces the Migrator to set the database state to have the given
	// version and dirty status without executing anything else. This is used
	// after a manual recovery has been completed.
	Set(ctx context.Context, version int, dirty bool) error
	// SetRecoveredToNext is the same as calling `Set` with the current version
	// and removing the "dirty" flag. This means that manual operations were
	// carried out to finish the migration step that previously failed. This
	// method is provided for convenience, so as to disambiguate interpretations
	// of how versions work.
	SetRecoveredToNext(context.Context) error
	// SetRecoveredToPrev is the same as calling `Set` with the current version
	// minus one and removing the "dirty" flag. This means that manual
	// operations were carried out to rollback the migration step that
	// previously failed. This method is provided for convenience, so as to
	// disambiguate interpretations of how versions work.
	SetRecoveredToPrev(context.Context) error

	// Next migrates the database to the next version. It returns io.EOF if the
	// database is already in the latest version.
	Next(context.Context) error
	// Prev migrates the database to the previous version. It returns io.EOF if
	// there is no previous step.
	Prev(context.Context) error
}

// Step represents a single database migration step, composed of one or more SQL
// statements logically related. Its `Up` and `Down` methods are low-level
// operations and are not inherently transactional. They return all the SQL
// statements run that succeeded and an error. Note that the string can be
// non-empty for a non-nil error (documenting this because the standard practice
// in Go is to return zero values when an error is returned).
type Step interface {
	Name() string
	Validate() error
	Up(context.Context, sqltemplate.Dialect, db.ContextExecer) (string, error)
	Down(context.Context, sqltemplate.Dialect, db.ContextExecer) (string, error)
}

// Statement represents a single SQL statement executed in a migration step. The
// `Up` and `Down` methods provide the templates that will be used for the
// respective operations in a migration. A DDL Statement should be fully
// reversible. DML should aim for the same, although in practice this is often
// not possible due to data having mutated by means of regular usage of the
// system. It is, thus, recommended to use a separate Statement to log what
// changes are being performed on a table. See more about this in the
// package-level docs.
type Statement interface {
	sqltemplate.SQLTemplate
	Up() *template.Template
	Down() *template.Template
}

// MigratorOptions are the options to create a default [Migrator].
type MigratorOptions struct {
	DB                     db.DB  // must be non-nil
	Migrations             []Step // must have at least one element, and none should be nil
	MigrationsLogTableName string // if empty, defaults to DefaultMigrationsLogTableName
}

func (o MigratorOptions) newBuiltinMigrations() []Step {
	return []Step{
		NewStep(
			fmt.Sprintf("create %q table for migrations log",
				o.MigrationsLogTableName),
			[]Statement{
				CreateTable(o.MigrationsLogTableName, []Column{
					NewColumn("id").Char(36).NotNull(),
					NewColumn("ts").BigInt().NotNull(),
					NewColumn("version").Int().NotNull(),
					NewColumn("is_up").Boolean().NotNull(),
					NewColumn("is_dirty").Boolean().NotNull(),
					NewColumn("statements").Text().NotNull(),
				}),

				CreateIndex(true, "id", o.MigrationsLogTableName, "id"),
				CreateIndex(true, "ts", o.MigrationsLogTableName, "ts"),
				CreateIndex(false, "version", o.MigrationsLogTableName, "version"),
			}),
	}
}

// New is like [NewWithDialect], but derives the SQL Dialect from the database
// driver name.
func New(o MigratorOptions) (Migrator, error) {
	drv := o.DB.DriverName()
	dl := sqltemplate.DialectForDriver(drv)
	if dl == nil {
		return nil, fmt.Errorf("no dialect for driver %q", drv)
	}

	return NewWithDialect(o, dl)
}

// NewWithDialect returns a new [Migrator] explicitly setting the dialect to
// use. The implementation will use transactions whenever available in the
// database engine (refer to [Migratior] for more informtation). A [][Step] to
// will be prepended to the provided list of migrations to run in `o`. This is
// needed to create the o.MigrationsLogTableName table to keep track of
// migrations and database state.
func NewWithDialect(o MigratorOptions, dl sqltemplate.Dialect) (Migrator, error) {
	if o.MigrationsLogTableName == "" {
		o.MigrationsLogTableName = DefaultMigrationsLogTableName
	}

	err := appendErr(nil, len(o.Migrations) == 0, "no migrations defined")

	for i, m := range o.Migrations {
		vErr := m.Validate()
		err = appendErr(err, vErr != nil, "Step #%d: %w", i, vErr)
	}

	if err != nil {
		return nil, err
	}
	// we don't hold a reference to the original slice
	o.Migrations = append(o.newBuiltinMigrations(), o.Migrations...)

	return migrator{
		MigratorOptions: o,
		dialect:         dl,
	}, nil
}

type migrator struct {
	MigratorOptions
	dialect sqltemplate.Dialect
}

func (m migrator) Len() int                       { return len(m.Migrations) }
func (m migrator) Next(ctx context.Context) error { return m.step(ctx, true) }
func (m migrator) Prev(ctx context.Context) error { return m.step(ctx, false) }

func (m migrator) Up(ctx context.Context) error {
	for i := 0; ; i++ {
		if err := m.Next(ctx); errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return fmt.Errorf("after advancing %d versions: %w", i, err)
		}
	}
	return nil
}

func (m migrator) Down(ctx context.Context) error {
	for i := 0; ; i++ {
		if err := m.Prev(ctx); errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return fmt.Errorf("after going back %d versions: %w", i, err)
		}
	}
	return nil
}

func (m migrator) Current(ctx context.Context) (int, bool, error) {
	entry, err := m.last(ctx, m.DB, time.Now().Unix())
	if entry != nil {
		return entry.Version, entry.IsDirty, nil
	}
	return 0, false, err
}

func (m migrator) Set(context.Context, int, bool) error {
	panic("not implemented!")
}

func (m migrator) SetRecoveredToNext(context.Context) error {
	panic("not implemented!")
}

func (m migrator) SetRecoveredToPrev(context.Context) error {
	panic("not implemented!")
}

func (m migrator) step(ctx context.Context, isUp bool) error {
	// levels sql.LevelReadCommitted and sql.LevelSerialized are the two most
	// widely available levels found among all currently supported transactional
	// database engines, as well as other candidates like CockroachDB and
	// Vitess.
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}

	// if run within a transaction, the SQL NOW() function returns either a
	// snapshot of time or the clock time depending on the implementation. The
	// SQL standard states that NOW() within a transaction should always return
	// the same time. PosgreSQL and CockroachDB honor this, but MySQL makes it a
	// bit harder to have a clock snapshot within a transaction (you have to
	// define a variable with the value of NOW() at the beginning of the
	// transaction to emulate the standard behaviour). So we opt to instead use
	// the SQL client time (the Go server time) to simplify this.
	//
	// NOTE: This has the obvious requirement that both the Go server and the
	// database server should have their clocks synchronized (adding this
	// clarification to help folks providig support so as to make sure to cover
	// all possible consideration)
	now := time.Now().Unix()

	return m.DB.WithTx(ctx, txOpts, func(ctx context.Context, tx db.Tx) error {
		var curVersion int
		entry, err := m.last(ctx, tx, now)
		if err != nil {
			return err
		}
		if entry != nil {
			curVersion = entry.Version
		}
		if isUp && curVersion == len(m.Migrations) ||
			!isUp && len(m.Migrations) == 0 {
			return io.EOF
		}

		newVersion := curVersion + 1
		runMig := m.Migrations[curVersion].Up
		if !isUp {
			newVersion = curVersion - 1
			runMig = m.Migrations[curVersion].Down
		}

		stmts, migErr := runMig(ctx, m.dialect, tx)
		newEntry := &migrationsLog{
			ID:         uuid.New().String(),
			Version:    newVersion,
			Timestamp:  now,
			IsUp:       isUp,
			IsDirty:    migErr != nil,
			Statements: stmts,
		}
		if migErr != nil {
			newEntry.Error = migErr.Error()
		}

		// if the database engine supports running the previous migration within
		// a transaction and it failed, then the following statement will be
		// rolled back, which is fine. Otherwise, we will be inserting the log
		// entry with `is_dirty` set to true
		_, err = dbutil.Exec(ctx, tx, migrationsLogInsert, migrationsLogReq{
			SQLTemplate:            sqltemplate.New(m.dialect),
			Entry:                  newEntry,
			MigrationsLogTableName: m.MigrationsLogTableName,
		})

		return appendErr(migErr, err != nil, "insert migrations log entry: %w", err)
	})
}

// last returns the last migration entry. If the system is at version zero
// (meaning a database without our migration run) then it returns nil, nil.
func (m migrator) last(ctx context.Context, x db.ContextExecer, now int64) (*migrationsLog, error) {
	migrationsLogExists, err := dbutil.QueryRow(ctx, m.DB, checkIfATableExists,
		&checkIfTableExistsReq{
			SQLTemplate: sqltemplate.New(m.dialect),
			TableName:   m.MigrationsLogTableName,
		})
	if err != nil {
		return nil, fmt.Errorf("check if %q table exists: %w",
			m.MigrationsLogTableName, err)
	}
	if !migrationsLogExists {
		return nil, nil
	}

	entry, err := dbutil.QueryRow(ctx, m.DB, migrationsLogGet, migrationsLogReq{
		SQLTemplate:            sqltemplate.New(m.dialect),
		Entry:                  new(migrationsLog),
		MigrationsLogTableName: m.MigrationsLogTableName,
	})
	if err != nil {
		return nil, fmt.Errorf("get last migration log entry: %w", err)
	}

	err = appendErr(err, entry.Version < 1 || entry.Version > len(m.Migrations),
		"invalid last database version found, should be within [1, %d]: %#v",
		len(m.Migrations), entry)

	err = appendErr(err, entry.Timestamp >= now,
		"last migration is in the future (check the clock in all servers): %#v",
		entry)

	if err != nil {
		return nil, err
	}

	return entry, nil
}

// NewStep returns a new migration composed of all the given statements.
func NewStep(name string, stmts []Statement) Step {
	err := appendErr(nil, name == "", "empty migration name")
	err = appendErr(err, len(stmts) == 0, "no statements in migration")

	for i := range stmts {
		vErr := stmts[i].Validate()
		err = appendErr(err, vErr != nil, "Statement #%d: %w", i, vErr)
	}

	return migration{
		name:  name,
		stmts: stmts,
		err:   err,
	}
}

type migration struct {
	name  string
	stmts []Statement
	err   error
}

func (m migration) Name() string    { return m.name }
func (m migration) Validate() error { return m.err }

func (m migration) Up(ctx context.Context, d sqltemplate.Dialect, x db.ContextExecer) (string, error) {
	if err := m.Validate(); err != nil {
		return "", fmt.Errorf("invalid migration: %w", err)
	}

	var b strings.Builder
	for i, stmt := range m.stmts {
		stmt.SetDialect(d)
		_, err := dbutil.Exec(ctx, x, stmt.Up(), stmt)
		if err != nil {
			return b.String(), fmt.Errorf("[Up] Statement #%d: %w", i, err)
		}

		// save the successfully run statement
		if i > 0 {
			b.WriteString(";\n")
		}
		_ = stmt.Up().Execute(&b, stmt) // discard error, already succeeded
	}

	return b.String(), nil
}

func (m migration) Down(ctx context.Context, d sqltemplate.Dialect, x db.ContextExecer) (string, error) {
	if err := m.Validate(); err != nil {
		return "", fmt.Errorf("invalid migration: %w", err)
	}

	// to revert operations, iterate backwards
	var b strings.Builder
	for i := len(m.stmts) - 1; i >= 0; i-- {
		stmt := m.stmts[i]
		stmt.SetDialect(d)
		_, err := dbutil.Exec(ctx, x, stmt.Down(), stmt)
		if err != nil {
			return b.String(), fmt.Errorf("[Down] Statement #%d: %w", i, err)
		}

		// save the successfully run statement
		if i > 0 {
			b.WriteString(";\n")
		}
		_ = stmt.Up().Execute(&b, stmt) // discard error, already succeeded
	}

	return b.String(), nil
}

// RawStatement returns a Statement where the Up and Down templates are manually
// written. The additional `data` argument allows passing an arbitrary payload
// to the template, which will be available as `.Data`. The code in both
// `upTmpl` and `downTmpl` must generate a single SQL statement each.
// Example usage:
//
//	RawStatement(
//		// Up
//		`INSERT INTO {{ .Ident "users" }} (
//			{{ .Ident "id" }},
//			{{ .Ident "name" }},
//			{{ .Ident "enabled" }}
//		) VALUES (
//			{{ .Arg .Data.ID }},
//			{{ .Arg .Data.Name }},
//			{{ .Arg .Data.Enabled }}
//		)`,
//
//		// Down
//		`DELETE FROM {{ .Ident "users" }}
//			WHERE {{ .Ident "id" }} = {{ .Arg .Data.ID }}`,
//
//		// Data
//		struct{
//			ID      string
//			Name    string
//			Enabled bool
//		}{
//			ID:      "dcca3af5-8dfd-4d8f-afd1-dfa39b904c58",
//			Name:    "admin",
//			Enabled: true,
//		},
//	)
//
// NOTE: this example provides an example DML. Please, read the package-level
// docs to learn more about recommendations when adding DML migrations.
func RawStatement(upSQLTmpl, downSQLTmpl string, data any) Statement {
	upTmpl, upErr := template.New("raw").Parse(upSQLTmpl)
	downTmpl, downErr := template.New("raw").Parse(downSQLTmpl)

	err := appendErr(nil, upErr != nil, "parse up statement: %w", upErr)
	err = appendErr(err, downErr != nil, "parse down statement: %w", downErr)

	return rawStatement{
		SQLTemplate: sqltemplate.New(nil),
		Data:        data,
		upTmpl:      upTmpl,
		downTmpl:    downTmpl,
		err:         err,
	}
}

type rawStatement struct {
	sqltemplate.SQLTemplate
	upTmpl, downTmpl *template.Template
	Data             any
	err              error
}

func (r rawStatement) Validate() error          { return r.err }
func (r rawStatement) Up() *template.Template   { return r.upTmpl }
func (r rawStatement) Down() *template.Template { return r.downTmpl }

// CreateTable returns a [Statement] that adds a new table. At least one Column
// must be specified. Example usage:
//
//	CreateTable("users", Columns{
//		NewColumn("id").VarChar(36).NotNull(),
//		NewColumn("name").VarChar(128).NotNull(),
//		NewColumn("enabled").Boolean().NotNull().Default(true),
//	})
//
// Remarks: create a unique index on a set of columns that are not nullable in a
// separate Statement to achieve the semantic equivalent of a primary key.
//
// See the following references for implementation-specific information:
//   - https://dev.mysql.com/doc/refman/en/create-table.html
//   - https://www.postgresql.org/docs/current/sql-createtable.html
//   - https://www.sqlite.org/lang_createtable.html
func CreateTable(name string, cols []Column) Statement {
	err := appendErr(nil, name == "", "empty table name")
	err = appendErr(err, len(cols) == 0, "no columns defined")

	colDefs := make([]columnDefinition, len(cols))
	for i := range cols {
		colDef, bErr := cols[i].build()
		colDefs[i] = colDef
		err = appendErr(err, bErr != nil, "column #%d: %w", i, bErr)
	}

	return createTable{
		SQLTemplate: sqltemplate.New(nil),
		TableName:   name,
		Columns:     colDefs,
		err:         err,
	}
}

type createTable struct {
	sqltemplate.SQLTemplate
	TableName string
	Columns   []columnDefinition
	err       error
}

func (t createTable) Validate() error          { return t.err }
func (t createTable) Up() *template.Template   { return tableCreateTmpl }
func (t createTable) Down() *template.Template { return tableDropTmpl }

// AlterTableAddColumn returns a statement that adds a new Column to an existing
// table. If the Column has the NOT NULL constraint, then it should specify a
// default value that will not serialize as NULL. Example usage:
//
//	AlterTableAddColumn("users", NewColumn("age").SmallInt())
//
// See the following references for implementation-specific information:
//   - https://dev.mysql.com/doc/refman/en/alter-table.html
//   - https://www.postgresql.org/docs/current/sql-altertable.html
//   - https://www.sqlite.org/lang_altertable.html
func AlterTableAddColumn(tableName string, col Column) Statement {
	colDef, bErr := col.build()
	err := appendErr(nil, bErr != nil, "new column: %w", bErr)
	err = appendErr(err, tableName == "", "empty table name")

	if bErr == nil && !colDef.ColNullable && !colDef.ColHasDefault {
		err = appendErr(err, true, "NOT NULL column should have default value")
	}

	return alterTableAddColumn{
		SQLTemplate:      sqltemplate.New(nil),
		TableName:        tableName,
		columnDefinition: colDef,
		err:              err,
	}
}

type alterTableAddColumn struct {
	sqltemplate.SQLTemplate
	TableName string
	columnDefinition
	err error
}

func (ad alterTableAddColumn) Validate() error          { return ad.err }
func (ad alterTableAddColumn) Up() *template.Template   { return columnAddTmpl }
func (ad alterTableAddColumn) Down() *template.Template { return columnDropTmpl }

// CreateIndex returns a [Statement] that adds a new index on the given columns
// of `tableName`. The final index name will be:
//
//	"idx_" + tableName + "_" + idxSuffix
func CreateIndex(unique bool, idxSuffix, tableName string, colNames ...string) Statement {
	err := appendErr(nil, idxSuffix == "", "empty index suffix")
	err = appendErr(err, tableName == "", "empty table name")
	err = appendErr(err, len(colNames) == 0, "no columns in index")

	for i, col := range colNames {
		err = appendErr(err, col == "", "empty column name #%d", i)
	}

	return createIndex{
		SQLTemplate: sqltemplate.New(nil),
		IndexName:   "idx_" + tableName + "_" + idxSuffix,
		TableName:   tableName,
		ColumnNames: colNames,
		Unique:      unique,
		err:         err,
	}
}

type createIndex struct {
	sqltemplate.SQLTemplate
	IndexName, TableName string
	ColumnNames          []string
	Unique               bool
	err                  error
}

func (idx createIndex) Validate() error          { return idx.err }
func (idx createIndex) Up() *template.Template   { return indexCreateTmpl }
func (idx createIndex) Down() *template.Template { return indexDropTmpl }

// Column follows a builder pattern to provide a consistent way of defining a
// table column with a curated set of restrictions. These restrictions are
// designed to provide maximum interoperability and minimize friction across all
// the supported database implementation.
type Column struct {
	colName       string
	colType       string
	colLen        uint
	colDefault    any
	colHasDefault bool
	colNullable   bool
	colLenSet     bool
}

// NewColumn returns a new Column, which by default will be nullable. A bare
// minimum Column should also have a type besides its name, so call one of the
// type definition methods on the returned Column.
func NewColumn(name string) Column {
	return Column{
		colName:     name,
		colNullable: true,
	}
}

func (c Column) setType(t string) Column {
	c.colType = t
	c.colLen = 0
	c.colLenSet = false
	return c
}

func (c Column) setTypeN(format string, n uint) Column {
	c = c.setType(fmt.Sprintf(format, n))
	c.colLen = n
	c.colLenSet = true
	return c
}

func (c Column) SmallInt() Column      { return c.setType("SMALLINT") }
func (c Column) Int() Column           { return c.setType("INT") }
func (c Column) BigInt() Column        { return c.setType("BIGINT") }
func (c Column) Text() Column          { return c.setType("TEXT") }
func (c Column) BLOB() Column          { return c.setType("BLOB") }
func (c Column) Char(n uint) Column    { return c.setTypeN("CHAR(%d)", n) }
func (c Column) VarChar(n uint) Column { return c.setTypeN("VARCHAR(%d)", n) }
func (c Column) Boolean() Column       { return c.setType("BOOLEAN") }

func (c Column) NotNull() Column {
	c.colNullable = false
	return c
}

func (c Column) Default(v any) Column {
	c.colDefault = v
	c.colHasDefault = true
	return c
}

func (c Column) build() (columnDefinition, error) {
	err := appendErr(nil, c.colName == "", "empty column name")
	err = appendErr(err, c.colType == "", "empty column type")
	err = appendErr(err, c.colLenSet && c.colLen == 0, "length cannot be zero")
	err = appendErr(err, c.colLenSet && c.colLen > MaxSupportedStringLength,
		fmt.Sprintf("max column length %v exceeded", MaxSupportedStringLength))
	if err != nil {
		return columnDefinition{}, err
	}

	return columnDefinition{
		ColName:       c.colName,
		ColType:       c.colType,
		ColNullable:   c.colNullable,
		ColDefault:    c.colDefault,
		ColHasDefault: c.colHasDefault,
	}, nil
}

type columnDefinition struct {
	ColName       string
	ColType       string
	ColDefault    any
	ColHasDefault bool
	ColNullable   bool
}

// appendErr creates a new error if the given condition is true, and appends it
// to a previous error. It returns nil if both the previous error is nil and the
// condition is false.
// In general, we would check for an error and return immediately, which is
// recommended for most user-facing operations for a number of reasons. But this
// package is tailored to developers writing migrations, so we want to provide
// the maximum amount of feedback in a single run as possible to reduce
// development time.
func appendErr(prevErr error, cond bool, format string, args ...any) error {
	if !cond {
		return prevErr
	}
	newErr := fmt.Errorf(format, args...)
	if prevErr == nil {
		return newErr
	}
	return fmt.Errorf("%w;\n\tAlso: %w", prevErr, newErr)
}

type migrationsLog struct {
	ID         string
	Version    int
	Timestamp  int64
	IsUp       bool
	IsDirty    bool
	Error      string
	Statements string
}

type migrationsLogReq struct {
	sqltemplate.SQLTemplate
	Entry                  *migrationsLog
	MigrationsLogTableName string
}

func (m migrationsLogReq) Results() (*migrationsLog, error) {
	return m.Entry, nil
}

type checkIfTableExistsReq struct {
	sqltemplate.SQLTemplate
	TableName string
	Count     int64
}

func (x checkIfTableExistsReq) Results() (bool, error) {
	return x.Count > 0, nil
}
