package encryption

import (
	"embed"
	"fmt"
	"text/template"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, `data/*.sql`))

	// The SQL Commands
	sqlEncryptedValueCreate   = mustTemplate("encrypted_value_create.sql")
	sqlEncryptedValueRead     = mustTemplate("encrypted_value_read.sql")
	sqlEncryptedValueUpdate   = mustTemplate("encrypted_value_update.sql")
	sqlEncryptedValueDelete   = mustTemplate("encrypted_value_delete.sql")
	sqlEncryptedValueListAll  = mustTemplate("encrypted_value_list_all.sql")
	sqlEncryptedValueCountAll = mustTemplate("encrypted_value_count_all.sql")

	sqlDataKeyCreate      = mustTemplate("data_key_create.sql")
	sqlDataKeyRead        = mustTemplate("data_key_read.sql")
	sqlDataKeyReadCurrent = mustTemplate("data_key_read_current.sql")
	sqlDataKeyList        = mustTemplate("data_key_list.sql")
	sqlDataKeyDisable     = mustTemplate("data_key_disable.sql")
	sqlDataKeyDelete      = mustTemplate("data_key_delete.sql")
	sqlDataKeyDisableAll  = mustTemplate("data_key_disable_all.sql")
)

// TODO: Move this to a common place so that all stores can use
func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

/*************************************/
/**-- Encrypted Value Queries --**/
/*************************************/
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
	Name      string
	Version   int64
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r readEncryptedValue) Validate() error {
	return nil // TODO
}

// Update Encrypted Value
type updateEncryptedValue struct {
	sqltemplate.SQLTemplate
	Namespace     string
	Name          string
	Version       int64
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
	Name      string
	Version   int64
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r deleteEncryptedValue) Validate() error {
	return nil // TODO
}

type listAllEncryptedValues struct {
	sqltemplate.SQLTemplate
	Limit        int64
	Offset       int64
	HasUntilTime bool
	UntilTime    int64
}

func (r listAllEncryptedValues) Validate() error { return nil }

type countAllEncryptedValues struct {
	sqltemplate.SQLTemplate
	HasUntilTime bool
	UntilTime    int64
}

func (r countAllEncryptedValues) Validate() error { return nil }

/*************************************/
/**-- Data Key Queries --**/
/*************************************/
type createDataKey struct {
	sqltemplate.SQLTemplate
	Row *contracts.SecretDataKey
}

func (r createDataKey) Validate() error { return nil }

type readDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

func (r readDataKey) Validate() error { return nil }

type readCurrentDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	Label     string
}

func (r readCurrentDataKey) Validate() error { return nil }

type listDataKeys struct {
	sqltemplate.SQLTemplate
	Namespace string
}

func (r listDataKeys) Validate() error { return nil }

type disableDataKeys struct {
	sqltemplate.SQLTemplate
	Namespace string
	Updated   time.Time
}

func (r disableDataKeys) Validate() error { return nil }

type deleteDataKey struct {
	sqltemplate.SQLTemplate
	Namespace string
	UID       string
}

func (r deleteDataKey) Validate() error { return nil }

type disableAllDataKeys struct {
	sqltemplate.SQLTemplate
	Updated time.Time
}

func (r disableAllDataKeys) Validate() error { return nil }
