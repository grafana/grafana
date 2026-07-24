package token

import (
	"embed"
	"errors"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "data/*.sql"))

	sqlTokenCreate         = mustTemplate("token_create.sql")
	sqlTokenGetByName      = mustTemplate("token_get_by_name.sql")
	sqlTokenGetByHash      = mustTemplate("token_get_by_hash.sql")
	sqlTokenUpdateLastUsed = mustTemplate("token_update_last_used.sql")
	sqlTokenDelete         = mustTemplate("token_delete.sql")
	sqlTokenListBySA       = mustTemplate("token_list_by_sa.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type createToken struct {
	sqltemplate.SQLTemplate
	Row       *Token
	IsRevoked bool
}

func (r createToken) Validate() error {
	if r.Row == nil {
		return errors.New("token is required")
	}
	return nil
}

func (r createToken) Expires() int64 {
	if r.Row.Expires == nil {
		return 0
	}
	return *r.Row.Expires
}

type getTokenByName struct {
	sqltemplate.SQLTemplate
	Query *GetByNameQuery
}

func (r getTokenByName) Validate() error {
	if r.Query == nil {
		return errors.New("query is required")
	}
	return nil
}

type getTokenByHash struct {
	sqltemplate.SQLTemplate
	Hash string
}

func (r getTokenByHash) Validate() error { return nil }

type updateTokenLastUsed struct {
	sqltemplate.SQLTemplate
	ID         string
	LastUsedAt time.Time
}

func (r updateTokenLastUsed) Validate() error { return nil }

type deleteToken struct {
	sqltemplate.SQLTemplate
	Namespace          string
	ServiceAccountName string
	Name               string
}

func (r deleteToken) Validate() error { return nil }

type listTokensByServiceAccount struct {
	sqltemplate.SQLTemplate
	Namespace          string
	ServiceAccountName string
	Limit              int64
	Offset             int64
}

func (r listTokensByServiceAccount) Validate() error { return nil }
