//go:build arm

package sql

import (
	mysql "github.com/dolthub/go-mysql-server/sql"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// TODO: Implement for 32-bit arm
func MySQLColToFieldType(col *mysql.Column) (data.FieldType, error) {
	return data.FieldType{}, nil
}
