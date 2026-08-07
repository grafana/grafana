package migrations

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// TestIntegrationCountValidatorUsesResourceTableNotGetStats reproduces #128985: on
// non-SQLite drivers CountValidator used to call GetStats (Bleve DocCount),
// which can be one short of the resource table after a large bulk migrate.
// Validation must count the resource table even when driverName is postgres
// and must not require a search client.
func TestIntegrationCountValidatorUsesResourceTableNotGetStats(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	env := newTestEnv(t)
	engine := env.engine
	ensureMinimalResourceTable(t, engine)

	group := "dashboard.grafana.app"
	resourceName := "dashboards"
	namespace := "default" // org 1
	const n = 3

	legacyTable := fmt.Sprintf("count_val_%s", uuid.New().String()[:8])
	_, err := engine.Exec(fmt.Sprintf(
		"CREATE TABLE %s (id INTEGER PRIMARY KEY, org_id INTEGER)",
		engine.Quote(legacyTable),
	))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(legacyTable)))
	})

	for i := 1; i <= n; i++ {
		_, err = engine.Exec(
			fmt.Sprintf("INSERT INTO %s (id, org_id) VALUES (?, ?)", engine.Quote(legacyTable)),
			i, 1,
		)
		require.NoError(t, err)
	}

	groupCol := engine.Quote("group")
	for i := 1; i <= n; i++ {
		_, err = engine.Exec(fmt.Sprintf(`
INSERT INTO resource
	(guid, resource_version, %s, resource, namespace, name, previous_resource_version)
VALUES (?, ?, ?, ?, ?, ?, ?)`, groupCol),
			uuid.New().String(), int64(i), group, resourceName, namespace, fmt.Sprintf("dash-%d", i), int64(0),
		)
		require.NoError(t, err)
	}
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf(
			"DELETE FROM resource WHERE namespace = ? AND %s = ? AND resource = ?",
			groupCol,
		), namespace, group, resourceName)
	})

	gr := schema.GroupResource{Group: group, Resource: resourceName}
	// nil client + postgres driverName: GetStats must not be consulted.
	validator := CountValidation(gr, CountValidationOptions{
		Table: legacyTable,
		Where: "org_id = ?",
	})(nil, migrator.Postgres)

	sess := engine.NewSession()
	defer sess.Close()

	err = validator.Validate(context.Background(), sess, &resourcepb.BulkResponse{
		Summary: []*resourcepb.BulkResponse_Summary{{
			Namespace: namespace,
			Group:     group,
			Resource:  resourceName,
			Count:     n,
		}},
	}, log.New("test.count-validator"))
	require.NoError(t, err)
}

func TestIntegrationCountValidatorFailsWhenResourceTableShort(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	env := newTestEnv(t)
	engine := env.engine
	ensureMinimalResourceTable(t, engine)

	group := "dashboard.grafana.app"
	resourceName := "dashboards-short"
	namespace := "default"

	legacyTable := fmt.Sprintf("count_val_short_%s", uuid.New().String()[:8])
	_, err := engine.Exec(fmt.Sprintf(
		"CREATE TABLE %s (id INTEGER PRIMARY KEY, org_id INTEGER)",
		engine.Quote(legacyTable),
	))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(legacyTable)))
	})

	_, err = engine.Exec(
		fmt.Sprintf("INSERT INTO %s (id, org_id) VALUES (1, 1), (2, 1)", engine.Quote(legacyTable)),
	)
	require.NoError(t, err)

	// Only one unified row for two legacy rows.
	groupCol := engine.Quote("group")
	_, err = engine.Exec(fmt.Sprintf(`
INSERT INTO resource
	(guid, resource_version, %s, resource, namespace, name, previous_resource_version)
VALUES (?, ?, ?, ?, ?, ?, ?)`, groupCol),
		uuid.New().String(), int64(1), group, resourceName, namespace, "dash-1", int64(0),
	)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf(
			"DELETE FROM resource WHERE namespace = ? AND %s = ? AND resource = ?",
			groupCol,
		), namespace, group, resourceName)
	})

	gr := schema.GroupResource{Group: group, Resource: resourceName}
	validator := CountValidation(gr, CountValidationOptions{
		Table: legacyTable,
		Where: "org_id = ?",
	})(nil, migrator.Postgres)

	sess := engine.NewSession()
	defer sess.Close()

	err = validator.Validate(context.Background(), sess, &resourcepb.BulkResponse{
		Summary: []*resourcepb.BulkResponse_Summary{{
			Namespace: namespace,
			Group:     group,
			Resource:  resourceName,
			Count:     1,
		}},
	}, log.New("test.count-validator"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "count mismatch")
}

func ensureMinimalResourceTable(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	exists, err := engine.IsTableExist("resource")
	require.NoError(t, err)
	if exists {
		return
	}
	groupCol := engine.Quote("group")
	_, err = engine.Exec(fmt.Sprintf(`
CREATE TABLE resource (
	guid TEXT PRIMARY KEY,
	resource_version BIGINT,
	%s TEXT NOT NULL,
	resource TEXT NOT NULL,
	namespace TEXT NOT NULL,
	name TEXT NOT NULL,
	previous_resource_version BIGINT
)`, groupCol))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec("DROP TABLE IF EXISTS resource")
	})
}
