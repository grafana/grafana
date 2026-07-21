package authimpl

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type tokenQuery struct {
	sqltemplate.SQLTemplate
	TokenTable        string
	Token             *userAuthToken
	HashedToken       string
	ExpectedToken     string
	Previous          bool
	ExternalSessionID int64
	UserAgent         string
	ClientIP          string
	RotatedAt         int64
	TokenID           int64
	UserID            int64
	UserIDs           []int64
	CreatedAfter      int64
	RotatedAfter      int64
	HasUserID         bool
	RevokedBefore     int64
	CreatedBefore     int64
	RotatedBefore     int64
}

func (q tokenQuery) Validate() error { return nil }

func (q tokenQuery) TokenColumns() (string, error) {
	columns := []string{"id", "user_id", "auth_token", "prev_auth_token", "user_agent", "client_ip", "auth_token_seen", "seen_at", "rotated_at", "created_at", "updated_at", "revoked_at", "external_session_id"}
	quoted := make([]string, len(columns))
	for i, column := range columns {
		var err error
		quoted[i], err = q.Ident(column)
		if err != nil {
			return "", err
		}
	}
	return strings.Join(quoted, ", "), nil
}

type externalSessionQuery struct {
	sqltemplate.SQLTemplate
	ExternalSessionTable string
	Session              *auth.ExternalSession
	ID                   int64
	UserID               int64
	UserIDs              []int64
	SessionIDHash        string
	NameIDHash           string
	ExpiresAt            legacysql.DBTime
	CreatedAt            legacysql.DBTime
}

func (q externalSessionQuery) Validate() error { return nil }

func (q externalSessionQuery) ExternalSessionColumns() (string, error) {
	columns := []string{"id", "user_id", "user_auth_id", "auth_module", "access_token", "id_token", "refresh_token", "session_id", "session_id_hash", "name_id", "name_id_hash", "expires_at", "created_at"}
	quoted := make([]string, len(columns))
	for i, column := range columns {
		var err error
		quoted[i], err = q.Ident(column)
		if err != nil {
			return "", err
		}
	}
	return strings.Join(quoted, ", "), nil
}

type orphanedExternalSessionsQuery struct {
	sqltemplate.SQLTemplate
	ExternalSessionTable         string
	TokenTable                   string
	ExternalSessionIDColumn      string
	TokenExternalSessionIDColumn string
}

func (q orphanedExternalSessionsQuery) Validate() error { return nil }
