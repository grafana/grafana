//go:build enterprise || pro
// +build enterprise pro

package migrations_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/storage/unified/migrations/testcases"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func enterpriseMigrationTestCases() []testcases.ResourceMigratorTestCase {
	return []testcases.ResourceMigratorTestCase{
		testcases.NewQueryCacheConfigsTestCase(),
	}
}

var enterpriseMigrationIDs = map[string]bool{
	"querycacheconfigs migration": false,
}

func TestIntegrationEnterpriseMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	allCases := append(defaultMigrationTestCases(), enterpriseMigrationTestCases()...)
	runMigrationTestSuite(t, allCases, migrationTestOptions{
		extraMigrationIDs: enterpriseMigrationIDs,
	})
}

func TestIntegrationEnterpriseKVMigrations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	allCases := append(defaultMigrationTestCases(), enterpriseMigrationTestCases()...)
	runMigrationTestSuite(t, allCases, migrationTestOptions{
		enableSQLKVBackend: true,
		extraMigrationIDs:  enterpriseMigrationIDs,
	})
}
