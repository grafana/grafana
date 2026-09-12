package orgdelete

import "github.com/grafana/grafana/pkg/storage/legacysql"

type Query struct {
	SQL  string
	Args []any
}

type Renderer func(dbHelper *legacysql.LegacyDatabaseHelper, orgID int64) (Query, error)

type Registrar interface {
	RegisterDelete(Renderer)
}
