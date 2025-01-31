package sql

import (
	"context"

	sqle "github.com/dolthub/go-mysql-server"
	mysql "github.com/dolthub/go-mysql-server/sql"

	"github.com/dolthub/go-mysql-server/sql/analyzer"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var dbName = "mydb"

type DB struct {
}

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

	// TODO: Implement row limit and converters, as per sqlutil.FrameFromRows
	// rowLimit := int64(1000) // TODO - set the row limit
	// // converters := sqlutil.ConvertersFromSchema(f.RefID, f.Fields)
	// // Use nil converters for now
	// var converters []sqlutil.Converter
	// rows := sqlutil.NewRowIter(mysqlRows, nil)
	// frame, err := sqlutil.FrameFromRows(rows, rowLimit, converters...)

	// TODO: Consider if this should be moved outside of this function
	// or indeed into convertToDataFrame
	f.RefID = tableName
	err = convertToDataFrame(ctx, iter, schema, f)
	if err != nil {
		return err
	}

	return nil
}
