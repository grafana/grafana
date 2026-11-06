package migrations

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

var sqliteValidationKey = resource.ListRequestKey{
	Namespace: "default", Group: "folder.grafana.app", Resource: "folders",
}

func sqliteValidationRevision(name string, rv int64, action resource.DataAction, folder string) resource.DataKey {
	return resource.DataKey{
		Namespace: sqliteValidationKey.Namespace, Group: sqliteValidationKey.Group, Resource: sqliteValidationKey.Resource,
		Name: name, ResourceVersion: rv, Action: action, Folder: folder,
	}
}

func newSQLiteValidationSession(t *testing.T, keys ...resource.DataKey) *xorm.Session {
	t.Helper()
	eng, err := xorm.NewEngine("sqlite3", filepath.Join(t.TempDir(), "validation.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, eng.Close()) })
	eng.DB().SetMaxOpenConns(1)
	_, err = eng.Exec("CREATE TABLE resource_history (key_path TEXT PRIMARY KEY)")
	require.NoError(t, err)
	_, err = eng.Exec("CREATE TABLE resource (guid TEXT, namespace TEXT, `group` TEXT, resource TEXT, name TEXT, folder TEXT)")
	require.NoError(t, err)
	_, err = eng.Exec("CREATE TABLE legacy_items (org_id INTEGER)")
	require.NoError(t, err)

	sess := eng.NewSession()
	t.Cleanup(sess.Close)
	require.NoError(t, sess.Begin())
	for _, key := range keys {
		_, err := sess.Exec("INSERT INTO resource_history (key_path) VALUES (?)", kv.DataSection+"/"+key.String())
		require.NoError(t, err)
	}
	return sess
}

func TestListUnifiedResourceKeysSQLite(t *testing.T) {
	root := sqliteValidationRevision("root", 1, resource.DataActionCreated, "")
	child := sqliteValidationRevision("child", 10, resource.DataActionUpdated, "root")
	recreated := sqliteValidationRevision("recreated", 3, resource.DataActionCreated, "root")
	upper := sqliteValidationRevision("ROOT", 1, resource.DataActionCreated, "")
	otherNamespace := root
	otherNamespace.Namespace = "default-other"
	otherGroup := root
	otherGroup.Group = "other.grafana.app"
	otherResource := root
	otherResource.Resource = "folders-other"
	sess := newSQLiteValidationSession(t,
		root, child, recreated, upper, otherNamespace, otherGroup, otherResource,
		sqliteValidationRevision("child", 9, resource.DataActionCreated, "old-parent"),
		sqliteValidationRevision("deleted", 1, resource.DataActionCreated, ""),
		sqliteValidationRevision("deleted", 2, resource.DataActionDeleted, ""),
		sqliteValidationRevision("recreated", 1, resource.DataActionCreated, ""),
		sqliteValidationRevision("recreated", 2, resource.DataActionDeleted, ""),
	)

	var keys []resource.DataKey
	for key, err := range listUnifiedResourceKeysSQLite(t.Context(), sess, sqliteValidationKey) {
		require.NoError(t, err)
		keys = append(keys, key)
	}
	require.ElementsMatch(t, []resource.DataKey{root, child, recreated, upper}, keys)

	for _, err := range listUnifiedResourceKeysSQLite(t.Context(), sess, sqliteValidationKey) {
		require.NoError(t, err)
		break
	}
	rows, err := sess.Query("SELECT COUNT(*) AS count FROM resource_history")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "12", string(rows[0]["count"]))
}

func TestListUnifiedResourceKeysSQLiteErrors(t *testing.T) {
	t.Run("malformed key", func(t *testing.T) {
		sess := newSQLiteValidationSession(t)
		_, err := sess.Exec("INSERT INTO resource_history (key_path) VALUES (?)", kv.DataSection+"/"+sqliteValidationKey.Prefix()+"bad/not-a-revision")
		require.NoError(t, err)
		_, err = CountUnifiedResourcesSQLite(t.Context(), sess, sqliteValidationKey, true)
		require.ErrorContains(t, err, "invalid resource version metadata")
	})

	t.Run("canceled context", func(t *testing.T) {
		sess := newSQLiteValidationSession(t)
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		_, err := CountUnifiedResourcesSQLite(ctx, sess, sqliteValidationKey, true)
		require.ErrorIs(t, err, context.Canceled)
	})
}

func TestCountValidatorSQLite(t *testing.T) {
	for _, backend := range []string{"SQL", "SQLKV"} {
		for _, missing := range []bool{false, true} {
			name := "complete"
			if missing {
				name = "missing resource"
			}
			t.Run(backend+"/"+name, func(t *testing.T) {
				sess := newSQLiteValidationSession(t,
					sqliteValidationRevision("root", 1, resource.DataActionCreated, ""),
					sqliteValidationRevision("child", 1, resource.DataActionCreated, "root"),
					sqliteValidationRevision("child", 2, resource.DataActionUpdated, "root"),
				)
				_, err := sess.Exec("INSERT INTO legacy_items (org_id) VALUES (1), (1)")
				require.NoError(t, err)
				if backend == "SQL" {
					_, err = sess.Exec("INSERT INTO resource (namespace, `group`, resource, name) VALUES ('default', 'folder.grafana.app', 'folders', 'root')")
					require.NoError(t, err)
					if !missing {
						_, err = sess.Exec("INSERT INTO resource (namespace, `group`, resource, name) VALUES ('default', 'folder.grafana.app', 'folders', 'child')")
						require.NoError(t, err)
					}
				} else if missing {
					key := sqliteValidationRevision("child", 3, resource.DataActionDeleted, "root")
					_, err = sess.Exec("INSERT INTO resource_history (key_path) VALUES (?)", kv.DataSection+"/"+key.String())
					require.NoError(t, err)
				}
				validator := CountValidation(schema.GroupResource{
					Group: sqliteValidationKey.Group, Resource: sqliteValidationKey.Resource,
				}, CountValidationOptions{Table: "legacy_items", Where: "org_id = ?"})(nil, ValidatorOptions{
					DriverName: migrator.SQLite, EnableSQLKVBackend: backend == "SQLKV",
				})
				err = validator.Validate(t.Context(), sess, &resourcepb.BulkResponse{
					Summary: []*resourcepb.BulkResponse_Summary{{
						Namespace: sqliteValidationKey.Namespace, Group: sqliteValidationKey.Group, Resource: sqliteValidationKey.Resource, Count: 2,
					}},
				}, log.NewNopLogger())
				if missing {
					require.ErrorContains(t, err, "legacy has 2, unified has 1")
				} else {
					require.NoError(t, err)
				}
			})
		}
	}
}

func TestFolderTreeValidatorSQLite(t *testing.T) {
	for _, backend := range []string{"SQL", "SQLKV"} {
		for _, parent := range []string{"root", "wrong-parent"} {
			t.Run(backend+"/"+parent, func(t *testing.T) {
				sess := newSQLiteValidationSession(t,
					sqliteValidationRevision("root", 1, resource.DataActionCreated, ""),
					sqliteValidationRevision("child", 1, resource.DataActionCreated, "old-parent"),
					sqliteValidationRevision("child", 2, resource.DataActionUpdated, parent),
					sqliteValidationRevision("deleted", 1, resource.DataActionDeleted, "root"),
				)
				_, err := sess.Exec("CREATE TABLE dashboard (id INTEGER, org_id INTEGER, uid TEXT, folder_uid TEXT, title TEXT, is_folder BOOLEAN)")
				require.NoError(t, err)
				_, err = sess.Exec("INSERT INTO dashboard VALUES (1, 1, 'root', '', 'Root', 1), (2, 1, 'child', 'root', 'Child', 1)")
				require.NoError(t, err)
				if backend == "SQL" {
					_, err = sess.Exec("INSERT INTO resource (namespace, `group`, resource, name, folder) VALUES ('default', 'folder.grafana.app', 'folders', 'root', ''), ('default', 'folder.grafana.app', 'folders', 'child', ?), ('other', 'folder.grafana.app', 'folders', 'foreign', ''), ('default', 'other.grafana.app', 'folders', 'foreign', ''), ('default', 'folder.grafana.app', 'other', 'foreign', '')", parent)
					require.NoError(t, err)
				}
				validator := FolderTreeValidation(schema.GroupResource{
					Group: sqliteValidationKey.Group, Resource: sqliteValidationKey.Resource,
				})(nil, ValidatorOptions{DriverName: migrator.SQLite, EnableSQLKVBackend: backend == "SQLKV"}).(*FolderTreeValidator)
				parents, err := validator.buildUnifiedFolderParentMapSQLite(t.Context(), sess, "default", log.NewNopLogger())
				require.NoError(t, err)
				require.Equal(t, map[string]string{"root": "", "child": parent}, parents)
				err = validator.Validate(t.Context(), sess, &resourcepb.BulkResponse{
					Summary: []*resourcepb.BulkResponse_Summary{{Namespace: "default", Group: sqliteValidationKey.Group, Resource: sqliteValidationKey.Resource, Count: 2}},
				}, log.NewNopLogger())
				if parent == "root" {
					require.NoError(t, err)
				} else {
					require.ErrorContains(t, err, "1 folders have incorrect parents")
				}
			})
		}
	}
}
