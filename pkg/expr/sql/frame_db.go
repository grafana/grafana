//go:build !arm

package sql

import (
	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var dbName = "frames"

// FramesDBProvider is a go-mysql-server DatabaseProvider that provides access to a set of Frames.
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

// NewFramesDBProvider creates a new FramesDBProvider with the given set of Frames.
func NewFramesDBProvider(frames data.Frames) mysql.DatabaseProvider {
	fMap := make(map[string]mysql.Table, len(frames))
	for _, frame := range frames {
		fMap[frame.RefID] = &FrameTable{Frame: frame}
	}
	return &FramesDBProvider{
		db: &framesDB{
			frames: fMap,
		},
	}
}

// framesDB is a go-mysql-server Database that provides access to a set of Frames.
type framesDB struct {
	frames map[string]mysql.Table
}

func (db *framesDB) GetTableInsensitive(_ *mysql.Context, tblName string) (mysql.Table, bool, error) {
	tbl, ok := mysql.GetTableInsensitive(tblName, db.frames)
	if !ok {
		return nil, false, nil
	}
	return tbl, ok, nil
}

func (db *framesDB) GetTableNames(_ *mysql.Context) ([]string, error) {
	s := make([]string, 0, len(db.frames))
	for k := range db.frames {
		s = append(s, k)
	}
	return s, nil
}

func (db *framesDB) Name() string {
	return dbName
}
