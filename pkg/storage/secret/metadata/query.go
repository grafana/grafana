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
	sqlKeeperCreate = mustTemplate("keeper_create.sql")
	sqlKeeperRead   = mustTemplate("keeper_read.sql")
	sqlKeeperUpdate = mustTemplate("keeper_update.sql")
	sqlKeeperList   = mustTemplate("keeper_list.sql")
	sqlKeeperDelete = mustTemplate("keeper_delete.sql")

	sqlKeeperListByName = mustTemplate("keeper_listByName.sql")

	sqlSecureValueOutboxAppend             = mustTemplate("secure_value_outbox_append.sql")
	sqlSecureValueOutboxReceiveN           = mustTemplate("secure_value_outbox_receiveN.sql")
	sqlSecureValueOutboxDelete             = mustTemplate("secure_value_outbox_delete.sql")
	sqlSecureValueOutboxUpdateReceiveCount = mustTemplate("secure_value_outbox_update_receive_count.sql")
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

/************************/
/**-- Keeper Queries --**/
/************************/

// Create
type createKeeper struct {
	sqltemplate.SQLTemplate
	Row *keeperDB
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r createKeeper) Validate() error {
	return nil // TODO
}

// Read
type readKeeper struct {
	sqltemplate.SQLTemplate
	Namespace   string
	Name        string
	IsForUpdate bool
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r readKeeper) Validate() error {
	return nil // TODO
}

// Update
type updateKeeper struct {
	sqltemplate.SQLTemplate
	Row *keeperDB
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r updateKeeper) Validate() error {
	return nil // TODO
}

// List
type listKeeper struct {
	sqltemplate.SQLTemplate
	Namespace string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r listKeeper) Validate() error {
	return nil // TODO
}

// Delete
type deleteKeeper struct {
	sqltemplate.SQLTemplate
	Namespace string
	Name      string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r deleteKeeper) Validate() error {
	return nil // TODO
}

// This is used at keeper store to validate create & update operations
type listByNameKeeper struct {
	sqltemplate.SQLTemplate
	Namespace   string
	KeeperNames []string
}

// Validate is only used if we use `dbutil` from `unifiedstorage`
func (r listByNameKeeper) Validate() error {
	return nil // TODO
}

/*************************************/
/**-- Secure Value Outbox Queries --**/
/*************************************/
type appendSecureValueOutbox struct {
	sqltemplate.SQLTemplate
	Row *outboxMessageDB
}

func (appendSecureValueOutbox) Validate() error { return nil }

type receiveNSecureValueOutbox struct {
	sqltemplate.SQLTemplate
	ReceiveLimit uint
}

func (receiveNSecureValueOutbox) Validate() error { return nil }

type deleteSecureValueOutbox struct {
	sqltemplate.SQLTemplate
	MessageID string
}

func (deleteSecureValueOutbox) Validate() error { return nil }

type incrementReceiveCountOutbox struct {
	sqltemplate.SQLTemplate
	MessageIDs []string
}

func (incrementReceiveCountOutbox) Validate() error { return nil }
