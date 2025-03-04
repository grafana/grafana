package sqlstore

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMain(m *testing.M) {
	SetupTestDB()
	code := m.Run()
	CleanupTestDB()
	os.Exit(code)
}

func TestInitEngine_ParseTimeInConnectionString(t *testing.T) {
	tests := []struct {
		name               string
		connectionString   string
		dbType             string
		expectedConnection string
	}{
		{
			name:               "MySQL with parseTime already present",
			connectionString:   "mysql://user:password@localhost:3306/alreadypresent?parseTime=false",
			dbType:             "mysql",
			expectedConnection: "user:password@tcp(localhost:3306)/alreadypresent?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&parseTime=false",
		},
		{
			name:               "MySQL with feature enabled",
			connectionString:   "mysql://user:password@localhost:3306/existingparams?charset=utf8",
			dbType:             "mysql",
			expectedConnection: "user:password@tcp(localhost:3306)/existingparams?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&charset=utf8&parseTime=true",
		},
		{
			name:               "MySQL with feature enabled",
			connectionString:   "mysql://user:password@localhost:3306/existingparams?charset=utf8",
			dbType:             "mysqlWithHooks",
			expectedConnection: "user:password@tcp(localhost:3306)/existingparams?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&charset=utf8&parseTime=true",
		},
		{
			name:               "Postgres",
			connectionString:   "postgres://username:password@localhost:5432/mydatabase",
			dbType:             "postgres",
			expectedConnection: "user=username host=localhost port=5432 dbname=mydatabase sslmode='' sslcert='' sslkey='' sslrootcert='' password=password",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			raw, err := ini.Load([]byte(`
				[database]
				url = ` + tt.connectionString))
			require.NoError(t, err)

			ftMgr := featuremgmt.WithFeatures()

			ss := &SQLStore{
				cfg: &setting.Cfg{
					Raw: raw,
				},
				features: ftMgr,
				log:      log.New(),
			}

			// don't check the error, the db isn't running. Just check the connection string is okay
			_ = ss.initEngine(nil)
			assert.Equal(t, tt.expectedConnection, ss.dbCfg.ConnectionString)
		})
	}
}
