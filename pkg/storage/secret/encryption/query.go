package encryption

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))

	// The SQL Commands
	encryptedValueCreate = mustTemplate("encrypted_value_create.sql")
	encryptedValueRead   = mustTemplate("encrypted_value_read.sql")
	encryptedValueUpdate = mustTemplate("encrypted_value_update.sql")
	encryptedValueDelete = mustTemplate("encrypted_value_delete.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Create Encrypted Value
type createEncryptedValue struct {
	sqltemplate.SQLTemplate
	Row *EncryptedValue
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r createEncryptedValue) Validate() error {
	return nil // TODO
}

// Read Encrypted Value
type readEncryptedValue struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r readEncryptedValue) Validate() error {
	return nil // TODO
}

// Update Encrypted Value
type updateEncryptedValue struct {
	sqltemplate.SQLTemplate
	Namespace     string
	UID           string
	EncryptedData []byte
	Updated       int64
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r updateEncryptedValue) Validate() error {
	return nil // TODO
}

// Delete Encrypted Value
type deleteEncryptedValue struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r deleteEncryptedValue) Validate() error {
	return nil // TODO
}
