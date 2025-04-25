package encryption

import (
	"embed"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))

	// The SQL Commands
	sqlEncryptedValueCreate = mustTemplate("encrypted_value_create.sql")
	sqlEncryptedValueRead   = mustTemplate("encrypted_value_read.sql")
	sqlEncryptedValueUpdate = mustTemplate("encrypted_value_update.sql")
	sqlEncryptedValueDelete = mustTemplate("encrypted_value_delete.sql")

	sqlDataKeyRead        = mustTemplate("data_key_read.sql")
	sqlDataKeyReadCurrent = mustTemplate("data_key_read_current.sql")
	sqlDataKeyList        = mustTemplate("data_key_list.sql")
	sqlDataKeyCreate      = mustTemplate("data_key_create.sql")
	sqlDataKeyDisable     = mustTemplate("data_key_disable.sql")
	sqlDataKeyDelete      = mustTemplate("data_key_delete.sql")
	sqlDataKeyReencrypt   = mustTemplate("data_key_reencrypt.sql")
)

// TODO: Move this to a common place so that all stores can use
func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

/*********************************/
/**-- Encripted Value Queries --**/
/*********************************/

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

/**************************/
/**-- Data Key Queries --**/
/**************************/

// SQL template request types
type readDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r readDataKey) Validate() error {
	return nil // TODO
}

type readCurrentDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	Label     string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r readCurrentDataKey) Validate() error {
	return nil // TODO
}

type listDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r listDataKey) Validate() error {
	return nil // TODO
}

type createDataKey struct {
	sqltemplate.SQLTemplate
	Row *SecretDataKey
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r createDataKey) Validate() error {
	return nil // TODO
}

type disableDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	Updated   time.Time
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r disableDataKey) Validate() error {
	return nil // TODO
}

type deleteDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r deleteDataKey) Validate() error {
	return nil // TODO
}

type reencryptDataKey struct {
	sqltemplate.SQLTemplate
	SelectStatements string
	Provider         encryption.ProviderID
	Updated          time.Time
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r reencryptDataKey) Validate() error {
	return nil // TODO
}
