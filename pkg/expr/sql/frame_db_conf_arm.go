//go:build arm

package sql

import (
	"errors"

	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// TODO: Implement for 32-bit arm
func MySQLColToFieldType(col *mysql.Column) (data.FieldType, error) {
	return data.FieldTypeUnknown, errors.New("arm not implemented")
}

func SchemaFromFrame(frame *data.Frame) mysql.Schema {
	return mysql.Schema{}
}
