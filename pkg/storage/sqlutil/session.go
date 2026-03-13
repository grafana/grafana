package sqlutil

import "github.com/grafana/grafana/pkg/services/sqlstore/session"

type SessionProvider interface {
	GetSqlxSession() *session.SessionDB
}
