package sql

import (
	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

/*

Need to fulfill interfaces:

Where these interfaces are from:

import (
	mysql "github.com/dolthub/go-mysql-server/sql"
)

type DatabaseProvider interface {
	// Database returns the database with the name given, or sql.ErrDatabaseNotFound if it doesn't exist.
	Database(ctx *Context, name string) (Database, error)
	// HasDatabase checks if the Database exists in the provider.
	HasDatabase(ctx *Context, name string) bool
	// AllDatabases returns a slice of all Databases in the provider.
	AllDatabases(ctx *Context) []Database
}

And Database is:

// Database represents the database. Its primary job is to provide access to all tables.
type Database interface {
	Nameable
	// GetTableInsensitive retrieves a table by its case-insensitive name. To be SQL compliant, databases should not
	// allow two tables with the same case-insensitive name. Behavior is undefined when two tables have the same
	// case-insensitive name.
	GetTableInsensitive(ctx *Context, tblName string) (Table, bool, error)
	// GetTableNames returns the table names of every table in the database. It does not return the names of temporary
	// tables
	GetTableNames(ctx *Context) ([]string, error)
}

And table is Fulfilled by the `FrameTable in Frame.go`

*/

type FramesDBProvider struct {
	db mysql.Database
}

func (p *FramesDBProvider) Database(_ *mysql.Context, _ string) (mysql.Database, error) {
	return p.db, nil
}

func (p *FramesDBProvider) HasDatabase(_ *mysql.Context, _ string) bool {
	return true
}

func (p *FramesDBProvider) AllDatabases(_ *mysql.Context) []mysql.Database {
	return []mysql.Database{p.db}
}

func NewFramesDBProvider(frames data.Frames) mysql.DatabaseProvider {
	fMap := make(map[string]mysql.Table, len(frames))
	for _, frame := range frames {
		fMap[frame.RefID] = &FrameTable{Frame: frame}
	}
	return &FramesDBProvider{
		db: &FramesDB{
			frames: fMap,
		},
	} // TODO
}

type FramesDB struct {
	frames map[string]mysql.Table
}

func (db *FramesDB) GetTableInsensitive(_ *mysql.Context, tblName string) (mysql.Table, bool, error) {
	tbl, ok := mysql.GetTableInsensitive(tblName, db.frames)
	if !ok {
		return nil, false, nil
	}
	return tbl, ok, nil
}

func (db *FramesDB) GetTableNames(_ *mysql.Context) ([]string, error) {
	s := make([]string, 0, len(db.frames))
	for k := range db.frames {
		s = append(s, k)
	}
	return s, nil
}

func (db *FramesDB) Name() string {
	return "frames"
}
