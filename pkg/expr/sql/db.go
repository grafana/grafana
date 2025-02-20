//go:build !arm

package sql

import (
	"context"

	sqle "github.com/dolthub/go-mysql-server"
	mysql "github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/go-mysql-server/sql/analyzer"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// DB is a database that can execute SQL queries against a set of Frames.
type DB struct{}

// QueryFrames runs the sql query query against a database created from frames, and returns the frame.
// The RefID of each frame becomes a table in the database.
// It is expected that there is only one frame per RefID.
// The name becomes the name and RefID of the returned frame.
func (db *DB) QueryFrames(ctx context.Context, name string, query string, frames []*data.Frame) (*data.Frame, error) {
	// We are parsing twice due to TablesList, but don't care fow now. We can save the parsed query and reuse it later if we want.
	if allow, err := AllowQuery(query); err != nil || !allow {
		if err != nil {
			return nil, err
		}
		return nil, err
	}

	pro := NewFramesDBProvider(frames)
	session := mysql.NewBaseSession()
	mCtx := mysql.NewContext(ctx, mysql.WithSession(session))

	// Select the database in the context
	mCtx.SetCurrentDatabase(dbName)

	// Empty dir does not disable secure_file_priv
	//ctx.SetSessionVariable(ctx, "secure_file_priv", "")

	// TODO: Check if it's wise to reuse the existing provider, rather than creating a new one
	a := analyzer.NewDefault(pro)

	engine := sqle.New(a, &sqle.Config{
		IsReadOnly: true,
	})

	schema, iter, _, err := engine.Query(mCtx, query)
	if err != nil {
		return nil, err
	}

	f, err := convertToDataFrame(mCtx, iter, schema)
	if err != nil {
		return nil, err
	}
	f.Name = name
	f.RefID = name

	return f, nil
}
