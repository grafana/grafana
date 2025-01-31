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

func (db *DB) QueryFramesInto(tableName string, query string, frames []*data.Frame, f *data.Frame) error {
	pro := NewFramesDBProvider(frames)
	session := mysql.NewBaseSession()
	ctx := mysql.NewContext(context.Background(), mysql.WithSession(session))

	// Select the database in the context
	ctx.SetCurrentDatabase(dbName)

	// Empty dir does not disable secure_file_priv
	//ctx.SetSessionVariable(ctx, "secure_file_priv", "")

	// TODO: Check if it's wise to reuse the existing provider, rather than creating a new one
	a := analyzer.NewDefault(pro)

	engine := sqle.New(a, &sqle.Config{
		IsReadOnly: true,
	})

	schema, iter, _, err := engine.Query(ctx, query)
	if err != nil {
		return err
	}

	f.RefID = tableName
	err = convertToDataFrame(ctx, iter, schema, f)
	if err != nil {
		return err
	}

	return nil
}
