package migrator

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// batchInsertTestPermissions inserts test permissions for migration testing
func batchInsertTestPermissions(cnt int, sqlStore db.DB, actionPrefix string) error {
	now := time.Now()
	suffixes := []string{"read", "write", "delete"}

	return batch(cnt, batchSize, func(start, end int) error {
		n := end - start
		permissions := make([]ac.Permission, 0, n)
		for i := start; i < end; i++ {
			suffix := suffixes[i%len(suffixes)]
			permissions = append(permissions, ac.Permission{
				RoleID:  1,
				Action:  fmt.Sprintf("%s:%s", actionPrefix, suffix),
				Scope:   fmt.Sprintf("%s:uid:%v", actionPrefix, i+1),
				Created: now,
				Updated: now,
			})
		}
		return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(permissions)
			return err
		})
	})
}

// TestIntegrationMigrateRemoveDeprecatedPermissions tests the deprecated permissions removal migration
func TestIntegrationMigrateRemoveDeprecatedPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Test 1: Basic functionality - remove deprecated permissions
	t.Run("removes deprecated permissions", func(t *testing.T) {
		// Insert deprecated permissions (apikeys: pattern)
		require.NoError(t, batchInsertTestPermissions(5, sqlStore, "apikeys"), "could not insert deprecated permissions")

		// Insert non-deprecated permissions
		require.NoError(t, batchInsertTestPermissions(3, sqlStore, "dashboards"), "could not insert non-deprecated permissions")

		// Count permissions before migration
		var permissionsBefore []ac.Permission
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return sess.Find(&permissionsBefore)
		})
		require.NoError(t, err, "could not count permissions before migration")
		assert.Equal(t, 8, len(permissionsBefore), "expected 8 permissions before migration")

		// Run migration
		require.NoError(t, MigrateRemoveDeprecatedPermissions(sqlStore, logger))

		// Count permissions after migration
		var permissionsAfter []ac.Permission
		err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			return sess.Find(&permissionsAfter)
		})
		require.NoError(t, err, "could not count permissions after migration")
		assert.Equal(t, 3, len(permissionsAfter), "expected 3 permissions after migration")

		// Verify only non-deprecated permissions remain
		for _, perm := range permissionsAfter {
			assert.NotContains(t, perm.Action, "apikeys:", "deprecated permission should have been removed")
		}
	})
}

// TestIntegrationMigrateRemoveDeprecatedPermissionsEmptyDB tests migration with empty database
func TestIntegrationMigrateRemoveDeprecatedPermissionsEmptyDB(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Run migration on empty database
	require.NoError(t, MigrateRemoveDeprecatedPermissions(sqlStore, logger))

	// Verify no permissions exist
	var permissions []ac.Permission
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissions)
	})
	require.NoError(t, err, "could not query permissions")
	assert.Empty(t, permissions, "expected no permissions in empty database")
}

// TestIntegrationMigrateRemoveDeprecatedPermissionsBatchProcessing tests batch processing with large dataset
func TestIntegrationMigrateRemoveDeprecatedPermissionsBatchProcessing(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Set small batch size for testing
	originalBatchSize := batchSize
	batchSize = 3
	defer func() { batchSize = originalBatchSize }()

	// Insert more deprecated permissions than batch size
	require.NoError(t, batchInsertTestPermissions(10, sqlStore, "apikeys"), "could not insert deprecated permissions")

	// Insert some non-deprecated permissions
	require.NoError(t, batchInsertTestPermissions(2, sqlStore, "folders"), "could not insert non-deprecated permissions")

	// Count permissions before migration
	var permissionsBefore []ac.Permission
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsBefore)
	})
	require.NoError(t, err, "could not count permissions before migration")
	assert.Equal(t, 12, len(permissionsBefore), "expected 12 permissions before migration")

	// Run migration
	require.NoError(t, MigrateRemoveDeprecatedPermissions(sqlStore, logger))

	// Count permissions after migration
	var permissionsAfter []ac.Permission
	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsAfter)
	})
	require.NoError(t, err, "could not count permissions after migration")
	assert.Equal(t, 2, len(permissionsAfter), "expected 2 permissions after migration")

	// Verify only non-deprecated permissions remain
	for _, perm := range permissionsAfter {
		assert.NotContains(t, perm.Action, "apikeys:", "deprecated permission should have been removed")
		assert.Contains(t, perm.Action, "folders:", "non-deprecated permission should remain")
	}
}

// TestIntegrationMigrateRemoveDeprecatedPermissionsNoDeprecated tests when no deprecated permissions exist
func TestIntegrationMigrateRemoveDeprecatedPermissionsNoDeprecated(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Insert only non-deprecated permissions
	require.NoError(t, batchInsertTestPermissions(5, sqlStore, "users"), "could not insert non-deprecated permissions")

	// Count permissions before migration
	var permissionsBefore []ac.Permission
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsBefore)
	})
	require.NoError(t, err, "could not count permissions before migration")
	assert.Equal(t, 5, len(permissionsBefore), "expected 5 permissions before migration")

	// Run migration
	require.NoError(t, MigrateRemoveDeprecatedPermissions(sqlStore, logger))

	// Count permissions after migration
	var permissionsAfter []ac.Permission
	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsAfter)
	})
	require.NoError(t, err, "could not count permissions after migration")
	assert.Equal(t, 5, len(permissionsAfter), "expected 5 permissions after migration (none should be removed)")

	// Verify all permissions remain unchanged
	for _, perm := range permissionsAfter {
		assert.NotContains(t, perm.Action, "apikeys:", "no deprecated permissions should exist")
		assert.Contains(t, perm.Action, "users:", "non-deprecated permissions should remain")
	}
}

// TestIntegrationMigrateRemoveDeprecatedPermissionsMixedPatterns tests mixed deprecated and non-deprecated patterns
func TestIntegrationMigrateRemoveDeprecatedPermissionsMixedPatterns(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Insert deprecated permissions
	require.NoError(t, batchInsertTestPermissions(3, sqlStore, "apikeys"), "could not insert deprecated permissions")

	// Insert various non-deprecated permissions
	require.NoError(t, batchInsertTestPermissions(2, sqlStore, "dashboards"), "could not insert dashboard permissions")
	require.NoError(t, batchInsertTestPermissions(2, sqlStore, "folders"), "could not insert folder permissions")
	require.NoError(t, batchInsertTestPermissions(2, sqlStore, "datasources"), "could not insert datasource permissions")

	// Count permissions before migration
	var permissionsBefore []ac.Permission
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsBefore)
	})
	require.NoError(t, err, "could not count permissions before migration")
	assert.Equal(t, 9, len(permissionsBefore), "expected 9 permissions before migration")

	// Run migration
	require.NoError(t, MigrateRemoveDeprecatedPermissions(sqlStore, logger))

	// Count permissions after migration
	var permissionsAfter []ac.Permission
	err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		return sess.Find(&permissionsAfter)
	})
	require.NoError(t, err, "could not count permissions after migration")
	assert.Equal(t, 6, len(permissionsAfter), "expected 6 permissions after migration")

	// Verify deprecated permissions are removed and others remain
	deprecatedCount := 0
	validCount := 0
	for _, perm := range permissionsAfter {
		if strings.HasPrefix(perm.Action, "apikeys:") {
			deprecatedCount++
		} else {
			validCount++
		}
	}
	assert.Equal(t, 0, deprecatedCount, "no deprecated permissions should remain")
	assert.Equal(t, 6, validCount, "expected 6 valid permissions to remain")
}
