package migrator

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestDataSourceCountValidatorSQLite(t *testing.T) {
	for _, backend := range []string{"SQL", "SQLKV"} {
		t.Run(backend, func(t *testing.T) {
			eng, err := xorm.NewEngine("sqlite3", ":memory:")
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, eng.Close()) })
			eng.DB().DB.SetMaxOpenConns(1)
			_, err = eng.Exec("CREATE TABLE resource_history (key_path TEXT PRIMARY KEY)")
			require.NoError(t, err)
			_, err = eng.Exec("CREATE TABLE resource (namespace TEXT, `group` TEXT, resource TEXT)")
			require.NoError(t, err)
			_, err = eng.Exec("CREATE TABLE data_source (org_id INTEGER)")
			require.NoError(t, err)
			_, err = eng.Exec("INSERT INTO data_source (org_id) VALUES (1), (1)")
			require.NoError(t, err)
			sess := eng.NewSession()
			t.Cleanup(sess.Close)
			require.NoError(t, sess.Begin())
			for _, key := range []string{
				"unified/data/prometheus.datasource.grafana.app/datasources/default/ds-a/1~created~",
				"unified/data/prometheus.datasource.grafana.app/datasources/default/ds-a/2~updated~",
				"unified/data/prometheus.datasource.grafana.app/datasources/default/deleted/1~deleted~",
				"unified/data/loki.datasource.grafana.app/datasources/default/ds-b/1~created~",
			} {
				_, err := sess.Exec("INSERT INTO resource_history (key_path) VALUES (?)", key)
				require.NoError(t, err)
			}
			if backend == "SQL" {
				_, err = sess.Exec("INSERT INTO resource VALUES ('default', 'prometheus.datasource.grafana.app', 'datasources'), ('default', 'loki.datasource.grafana.app', 'datasources')")
				require.NoError(t, err)
			}
			v := DataSourceCountValidation()(nil, migrations.ValidatorOptions{
				DriverName: migrator.SQLite, EnableSQLKVBackend: backend == "SQLKV",
			})
			response := &resourcepb.BulkResponse{
				Summary: []*resourcepb.BulkResponse_Summary{
					{Namespace: "default", Group: "prometheus.datasource.grafana.app", Resource: "datasources"},
					{Namespace: "default", Group: "loki.datasource.grafana.app", Resource: "datasources"},
				},
			}
			require.NoError(t, v.Validate(t.Context(), sess, response, log.NewNopLogger()))
			_, err = sess.Exec("INSERT INTO data_source (org_id) VALUES (1)")
			require.NoError(t, err)
			require.ErrorContains(t, v.Validate(t.Context(), sess, response, log.NewNopLogger()), "legacy has 3, unified has 2")
		})
	}
}
