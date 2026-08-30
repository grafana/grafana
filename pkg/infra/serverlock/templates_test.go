package serverlock

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "test_schema." + n
		},
	}

	newTemplate := func() sqltemplate.SQLTemplate {
		return mocks.NewTestingSQLTemplate()
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			updateVersionTemplate: {
				{
					Name: "update_version",
					Data: &updateVersionQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						Version:         2,
						LastExecution:   123,
						OperationUID:    "test-operation",
						PreviousVersion: 1,
					},
				},
			},
			getLockTemplate: {
				{
					Name: "get_lock",
					Data: &getLockQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						OperationUID:    "test-operation",
					},
				},
			},
			getLockForUpdateTemplate: {
				{
					Name: "get_lock_for_update",
					Data: &getLockForUpdateQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						OperationUID:    "test-operation",
					},
				},
			},
			updateLastExecutionTemplate: {
				{
					Name: "update_last_execution",
					Data: &updateLastExecutionQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						LastExecution:   123,
						OperationUID:    "test-operation",
					},
				},
			},
			releaseLockTemplate: {
				{
					Name: "release_lock",
					Data: &releaseLockQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						OperationUID:    "test-operation",
					},
				},
			},
			createLockTemplate: {
				{
					Name: "create_lock",
					Data: &createLockQuery{
						SQLTemplate:     newTemplate(),
						ServerLockTable: nodb.Table("server_lock"),
						OperationUID:    "test-operation",
						LastExecution:   123,
						Version:         0,
					},
				},
			},
		},
	})
}
