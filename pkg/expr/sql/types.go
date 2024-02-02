package sql

import (
	"database/sql/driver"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Row []driver.Value
type Table []Row
type Tables map[string]Table
type Fields map[string]*data.Field
type Unknown map[string]bool
type TableFields map[string][]*data.Field
