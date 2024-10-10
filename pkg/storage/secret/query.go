package secret

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed *.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `*.sql`))

	// The SQL Commands
	sqlSecureValueInsert  = mustTemplate("secure_value_insert.sql")
	sqlSecureValueUpdate  = mustTemplate("secure_value_update.sql")
	sqlSecureValueEncrypt = mustTemplate("secure_value_encrypt.sql")
	sqlSecureValueList    = mustTemplate("secure_value_list.sql")
	sqlSecureValueEvent   = mustTemplate("secure_value_event.sql")
	sqlSecureValueHistory = mustTemplate("secure_value_event_history.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Create
type createSecureValue struct {
	sqltemplate.SQLTemplate
	Row *secureValueRow
}

func (r createSecureValue) Validate() error {
	return nil // TODO
}

// Update
type updateSecureValue struct {
	sqltemplate.SQLTemplate
	Row *secureValueRow
}

func (r updateSecureValue) Validate() error {
	return nil // TODO
}

// Update
type encryptSecureValue struct {
	sqltemplate.SQLTemplate
	UID       string
	Encrypted *EncryptedValue
	Timestamp int64
}

func (r encryptSecureValue) Validate() error {
	return nil // TODO
}

// Update
type writeEvent struct {
	sqltemplate.SQLTemplate
	Event *secureValueEvent
}

func (r writeEvent) Validate() error {
	return nil // TODO
}

// List
type listSecureValues struct {
	sqltemplate.SQLTemplate
	Request secureValueRow
}

func (r listSecureValues) Validate() error {
	return nil // TODO
}

// Update
type readHistory struct {
	sqltemplate.SQLTemplate
	Namespace string
	Name      string
	Continue  int64
}

func (r readHistory) Validate() error {
	return nil // TODO
}
