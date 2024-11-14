package sql

import (
	"database/sql"
	"errors"
	"io"
	"reflect"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/memory"
	gomysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/information_schema"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
)

// CustomRows wraps gosql.RowIter to implement database/sql's Rows interface
type CustomRows struct {
	iter    gomysql.RowIter
	columns []string
	current gomysql.Row
}

func (r *CustomRows) Close() error {
	// TODO - provide a proper context
	var context gomysql.Context

	return r.iter.Close(&context)
}

func (r *CustomRows) Next() bool {
	// TODO - provide a proper context
	var context gomysql.Context

	row, err := r.iter.Next(&context)
	if err == io.EOF {
		return false
	}
	if err != nil {
		// Handle error (you might want to log it or handle it differently)
		return false
	}
	r.current = row
	return true
}

func (r *CustomRows) Columns() ([]string, error) {
	return r.columns, nil
}

func (r *CustomRows) Scan(dest ...interface{}) error {
	for i, v := range r.current {
		if i >= len(dest) {
			break
		}
		reflect.ValueOf(dest[i]).Elem().Set(reflect.ValueOf(v))
	}
	return nil
}

func (r *CustomRows) ColumnTypes() ([]*sql.ColumnType, error) {
	// Implement if needed, return nil for now
	return nil, nil
}

// NewCustomRows creates a new CustomRows from gosql.RowIter
func NewCustomRows(iter gomysql.RowIter, columns []string) *CustomRows {
	return &CustomRows{
		iter:    iter,
		columns: columns,
	}
}

// ConvertToDataFrame converts gosql.RowIter to a Grafana DataFrame
func ConvertToDataFrame(iter gomysql.RowIter, columns []string) (*data.Frame, error) {

	rowLimit := int64(1000) // TODO - set the row limit

	// // converters := sqlutil.ConvertersFromSchema(f.RefID, f.Fields)
	// // Use nil converters for now
	var converters []sqlutil.Converter

	// rows := sqlutil.NewRowIter(mysqlRows, nil)
	// frame, err := sqlutil.FrameFromRows(rows, rowLimit, converters...)

	customRows := NewCustomRows(iter, columns)
	return sqlutil.FrameFromRows(customRows, rowLimit, converters...)
}

type DB struct {
	inMemoryDb *memory.Database
}

func (db *DB) TablesList(rawSQL string) ([]string, error) {
	return nil, errors.New("not implemented")
}

func (db *DB) RunCommands(commands []string) (string, error) {
	return "", errors.New("not implemented")
}

func (db *DB) QueryFramesInto(name string, query string, frames []*data.Frame, f *data.Frame) error {

	// error if more than zero frames received
	// TODO: Implement loading data into the database later
	if len(frames) > 0 {
		return errors.New("not implemented")
	}

	engine := sqle.NewDefault(
		gomysql.NewDatabaseProvider(
			db.inMemoryDb,
			information_schema.NewInformationSchemaDatabase(),
		))

	ctx := gomysql.NewEmptyContext()

	// TODO - stop overriding the query
	query = `SELECT 'sam' AS 'name', 40 AS 'age';`

	// TODO - catch the first return value, the schema, to set the schema of the frame
	_, iter, _, err := engine.Query(ctx, query)
	if err != nil {
		return err
	}

	// rowLimit := int64(1000) // TODO - set the row limit

	// // converters := sqlutil.ConvertersFromSchema(f.RefID, f.Fields)
	// // Use nil converters for now
	// var converters []sqlutil.Converter

	// rows := sqlutil.NewRowIter(mysqlRows, nil)
	// frame, err := sqlutil.FrameFromRows(rows, rowLimit, converters...)

	f, err = ConvertToDataFrame(iter, []string{"name", "age"})
	if err != nil {
		return err
	}

	return nil
}

func NewInMemoryDB() *DB { // TODO - name the function. The InMemoryDB name is now used on line 13
	return &DB{
		inMemoryDb: memory.NewDatabase("test"), // TODO - change the name of the database
	}
}
