package legacy

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestPreferencesCountValidatorSQLite(t *testing.T) {
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
			sess := eng.NewSession()
			t.Cleanup(sess.Close)
			require.NoError(t, sess.Begin())
			for _, key := range []string{
				"unified/data/preferences.grafana.app/preferences/default/user-a/1~created~",
				"unified/data/preferences.grafana.app/preferences/default/user-a/2~updated~",
				"unified/data/preferences.grafana.app/preferences/default/user-b/1~created~",
				"unified/data/preferences.grafana.app/preferences/default/user-b/2~deleted~",
				"unified/data/preferences.grafana.app/preferences/other/user-c/1~created~",
			} {
				_, err := sess.Exec("INSERT INTO resource_history (key_path) VALUES (?)", key)
				require.NoError(t, err)
			}
			if backend == "SQL" {
				_, err = sess.Exec("INSERT INTO resource VALUES ('default', 'preferences.grafana.app', 'preferences')")
				require.NoError(t, err)
			}
			v := PreferencesCountValidation(schema.GroupResource{
				Group: "preferences.grafana.app", Resource: "preferences",
			})(nil, migrations.ValidatorOptions{DriverName: migrator.SQLite, EnableSQLKVBackend: backend == "SQLKV"}).(*preferencesCountValidator)
			count, err := v.countUnified(t.Context(), sess, &resourcepb.BulkResponse_Summary{
				Namespace: "default", Group: "preferences.grafana.app", Resource: "preferences",
			})
			require.NoError(t, err)
			require.EqualValues(t, 1, count)
		})
	}
}
