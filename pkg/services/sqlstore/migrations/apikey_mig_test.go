package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func TestAPIKeyServiceAccountIndexMigration(t *testing.T) {
	tests := []struct {
		dialect   string
		columnSQL string
		indexSQL  string
	}{
		{
			dialect:   MySQL,
			columnSQL: "alter table `api_key` ADD COLUMN `service_account_id` BIGINT(20) NULL",
			indexSQL:  "CREATE INDEX `IDX_api_key_org_id_service_account_id` ON `api_key` (`org_id`,`service_account_id`);",
		},
		{
			dialect:   Postgres,
			columnSQL: `alter table "api_key" ADD COLUMN "service_account_id" BIGINT NULL`,
			indexSQL:  `CREATE INDEX "IDX_api_key_org_id_service_account_id" ON "api_key" ("org_id","service_account_id");`,
		},
		{
			dialect:   SQLite,
			columnSQL: "alter table `api_key` ADD COLUMN `service_account_id` INTEGER NULL",
			indexSQL:  "CREATE INDEX `IDX_api_key_org_id_service_account_id` ON `api_key` (`org_id`,`service_account_id`);",
		},
	}

	for _, tt := range tests {
		t.Run(tt.dialect, func(t *testing.T) {
			err := CheckExpectedMigrations(tt.dialect, []ExpectedMigration{
				{Id: "Add service account foreign key", SQL: tt.columnSQL},
				{Id: "Add index api_key.org_id_service_account_id", SQL: tt.indexSQL},
			}, addApiKeyMigrations)
			require.NoError(t, err)
		})
	}
}
