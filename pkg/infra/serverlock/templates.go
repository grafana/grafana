package serverlock

import (
	"embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	//go:embed queries/*.sql
	sqlTemplatesFS embed.FS

	sqlTemplates = template.Must(template.New("sql").ParseFS(sqlTemplatesFS, "queries/*.sql"))

	updateVersionTemplate       = mustTemplate("update_version.sql")
	getLockTemplate             = mustTemplate("get_lock.sql")
	getLockForUpdateTemplate    = mustTemplate("get_lock_for_update.sql")
	updateLastExecutionTemplate = mustTemplate("update_last_execution.sql")
	releaseLockTemplate         = mustTemplate("release_lock.sql")
	createLockTemplate          = mustTemplate("create_lock.sql")
)

func mustTemplate(filename string) *template.Template {
	if tmpl := sqlTemplates.Lookup(filename); tmpl != nil {
		return tmpl
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

type updateVersionQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	Version         int64
	LastExecution   int64
	OperationUID    string
	PreviousVersion int64
}

func (updateVersionQuery) Validate() error {
	return nil
}

type getLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (getLockQuery) Validate() error {
	return nil
}

type getLockForUpdateQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (getLockForUpdateQuery) Validate() error {
	return nil
}

type updateLastExecutionQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	LastExecution   int64
	OperationUID    string
}

func (updateLastExecutionQuery) Validate() error {
	return nil
}

type releaseLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
}

func (releaseLockQuery) Validate() error {
	return nil
}

type createLockQuery struct {
	sqltemplate.SQLTemplate
	ServerLockTable string
	OperationUID    string
	LastExecution   int64
	Version         int64
}

func (createLockQuery) Validate() error {
	return nil
}
