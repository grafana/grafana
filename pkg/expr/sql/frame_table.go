package sql

import (
	"io"
	"strings"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

/*
This is the interface I'm going for ... I think
it lives in in https://github.com/dolthub/go-mysql-server/sql package

type Table interface {
	Nameable
	fmt.Stringer
	// Schema returns the table's schema.
	Schema() Schema
	// Collation returns the table's collation.
	Collation() CollationID
	// Partitions returns the table's partitions in an iterator.
	Partitions(*Context) (PartitionIter, error)
	// PartitionRows returns the rows in the given partition, which was returned by Partitions.
	PartitionRows(*Context, Partition) (RowIter, error)
}
*/

type FrameTable struct {
	Frame  data.Frame
	schema mysql.Schema
}

// Name implements the sql.Nameable interface
func (ft *FrameTable) Name() string {
	return ft.Frame.RefID
	// TODO: return an actual table name or derive from Frame
}

// String implements the fmt.Stringer interface
func (ft *FrameTable) String() string {
	return ft.Name()
}

func schemaFromFrame(frame data.Frame) mysql.Schema {
	schema := make(mysql.Schema, len(frame.Fields))
	for i, field := range frame.Fields {
		schema[i] = &mysql.Column{
			Name:     field.Name,
			Type:     convertDataType(field.Type()),
			Nullable: field.Type().Nullable(),
			Source:   strings.ToLower(frame.RefID),
		}
	}
	// TODO: build a schema based on ft.Frame
	return schema
}

// Schema implements the mysql.Table interface
func (ft *FrameTable) Schema() mysql.Schema {
	if ft.schema == nil {
		ft.schema = schemaFromFrame(ft.Frame)
	}

}

// Collation implements the mysql.Table interface
func (ft *FrameTable) Collation() mysql.CollationID {
	// TODO: return the collation that fits your needs
	return mysql.Collation_Unspecified
}

// Partitions implements the mysql.Table interface
func (ft *FrameTable) Partitions(ctx *mysql.Context) (mysql.PartitionIter, error) {
	return &noopPartitionIter{}, nil
}

// PartitionRows implements the mysql.Table interface
func (ft *FrameTable) PartitionRows(ctx *mysql.Context, _ mysql.Partition) (mysql.RowIter, error) {
	// TODO
	return nil, nil
}

type rowIter struct {
	ft  FrameTable
	row int
}

func (ri *rowIter) Next() (mysql.Row, error) {

}

// #  NO-OP Partition iterator
// Will I need real partitions to work with funcs?
type noopPartitionIter struct {
	done bool
}

func (i *noopPartitionIter) Next(*mysql.Context) (mysql.Partition, error) {
	if !i.done {
		i.done = true
		return noopParition, nil
	}
	return nil, io.EOF
}

func (i *noopPartitionIter) Close(*mysql.Context) error {
	return nil
}

var noopParition = partition(nil)

type partition []byte

func (p partition) Key() []byte {
	return p
}
