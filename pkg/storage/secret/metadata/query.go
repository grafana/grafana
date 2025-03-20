package metadata

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
	sqlKeeperCreate          = mustTemplate("keeper_create.sql")
	sqlKeeperRead            = mustTemplate("keeper_read.sql")
	sqlKeeperUpdate          = mustTemplate("keeper_update.sql")
	sqlKeeperList            = mustTemplate("keeper_list.sql")
	sqlKeeperDelete          = mustTemplate("keeper_delete.sql")
	sqlKeeperListByName      = mustTemplate("keeper_listByName.sql")
	sqlSecureValueListByName = mustTemplate("secure_value_listByName.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type createKeeper struct {
	sqltemplate.SQLTemplate
	Row *keeperDB
}

// Read
type readKeeper struct {
	sqltemplate.SQLTemplate
	Namespace string
	Name      string
}

// Update
type updateKeeper struct {
	sqltemplate.SQLTemplate
	Row *keeperDB
}

// List
type listKeeper struct {
	sqltemplate.SQLTemplate
	Namespace string
}

// Delete
type deleteKeeper struct {
	sqltemplate.SQLTemplate
	Namespace string
	Name      string
}

// This is used at keeper store to validate create & update operations
type listByNameSecureValue struct {
	sqltemplate.SQLTemplate
	Namespace        string
	UsedSecureValues []string
}

// This is used at keeper store to validate create & update operations
type listByNameKeeper struct {
	sqltemplate.SQLTemplate
	Namespace         string
	ThirdPartyKeepers []string
	ExcludeKeeperType string
}

/**
// Validate is only used if we use `dbutil` from `unifiedstorage`. TODO: remove?
func (r createKeeper) Validate() error {
	return nil // TODO
}

// Validate is only used if we use `dbutil` from `unifiedstorage`. TODO: remove?
func (r readKeeper) Validate() error {
	return nil // TODO
}

// Validate is only used if we use `dbutil` from `unifiedstorage`. TODO: remove?
func (r updateKeeper) Validate() error {
	return nil // TODO
}

// Validate is only used if we use `dbutil` from `unifiedstorage`. TODO: remove?
func (r listKeeper) Validate() error {
	return nil // TODO
}


// Validate is only used if we use `dbutil` from `unifiedstorage`. TODO: remove?
func (r deleteKeeper) Validate() error {
	return nil // TODO
}

*/
