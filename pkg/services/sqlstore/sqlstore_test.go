package sqlstore

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMain(m *testing.M) {
	SetupTestDB()
	code := m.Run()
	CleanupTestDB()
	os.Exit(code)
}

func TestIntegrationIsUniqueConstraintViolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	store, _ := InitTestDB(t)

	testCases := []struct {
		desc string
		f    func(*testing.T, *DBSession) error
	}{
		{
			desc: "successfully detect primary key violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with provided ID (primary key) twice
				now := time.Now()
				org := org.Org{Name: "test org primary key violation", Created: now, Updated: now, ID: 42}
				err := sess.InsertId(&org, store.dialect)
				require.NoError(t, err)

				// Provide a different name to avoid unique constraint violation
				org.Name = "test org 2"
				return sess.InsertId(&org, store.dialect)
			},
		},
		{
			desc: "successfully detect unique constrain violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with reserved name
				now := time.Now()
				org := org.Org{Name: "test org unique constrain violation", Created: now, Updated: now, ID: 43}
				err := sess.InsertId(&org, store.dialect)
				require.NoError(t, err)

				// Provide a different ID to avoid primary key violation
				org.ID = 44
				return sess.InsertId(&org, store.dialect)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			err := store.WithDbSession(context.Background(), func(sess *DBSession) error {
				return tc.f(t, sess)
			})
			require.Error(t, err)
			assert.True(t, store.dialect.IsUniqueConstraintViolation(err))
		})
	}
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
				settingsProvider: setting.ProvideService(&setting.Cfg{
					Raw: raw,
				}),
				features: ftMgr,
				log:      log.New(),
			}

			// don't check the error, the db isn't running. Just check the connection string is okay
			_ = ss.initEngine(nil)
			assert.Equal(t, tt.expectedConnection, ss.dbCfg.ConnectionString)
		})
	}
}
