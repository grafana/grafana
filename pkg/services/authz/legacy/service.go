package legacy

import (
	"github.com/grafana/grafana/pkg/services/authz/legacy/server"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func NewServer(sql legacysql.LegacyDatabaseProvider) *server.Server {
	return server.NewServer(sql)
}
