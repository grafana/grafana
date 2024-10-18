package legacy

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/legacy/server"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func NewServer(sql legacysql.LegacyDatabaseProvider, logger log.Logger) *server.Server {
	return server.NewServer(sql, logger)
}
