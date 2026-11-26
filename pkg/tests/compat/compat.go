// Package compat is the harness for cross-version compatibility tests.
//
// One Grafana version sets data up in a database (TestCompatSetup), another
// version starts on that same database and rewrites it (TestCompatUpdate), and
// the first version checks that its data survived (TestCompatVerify). Every
// package under pkg/tests/compat follows that shape; see README.md for how to add
// one and how to run them.
//
// The harness is a regular package rather than _test.go files, because the test
// packages under pkg/tests/compat import it, the same way pkg/tests/apis works.
package compat

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

// EnvDir names the directory holding the databases shared between the Grafana
// versions of one round trip. Tests skip when it is unset.
const EnvDir = "GRAFANA_COMPAT_DIR"

// EnvPrintOwners makes a test binary print the CODEOWNERS owners of its package and exit,
// without running any test. The phase runner uses it to report the package owners
// of a failed phase independently of the phase process.
const EnvPrintOwners = "GRAFANA_COMPAT_PRINT_OWNERS"

// EnvRole tells a phase which side of the round trip it runs on: "older" or "newer".
const EnvRole = "GRAFANA_COMPAT_ROLE"

// IsNewer reports whether this phase runs on the newer version. The newer version must
// keep serving everything the older one wrote. Without EnvRole, as in a local run of a
// single phase, nothing is held to that.
func IsNewer() bool {
	return os.Getenv(EnvRole) == "newer"
}

// Main is the TestMain body of every compat package. Each package gets its own
// SQLite file in EnvDir, so packages can run in parallel and one package's data
// cannot break another package's tests.
func Main(m *testing.M) {
	if os.Getenv(EnvPrintOwners) != "" {
		owners, err := packageOwners()
		if err != nil {
			fmt.Fprintf(os.Stderr, "compat: %v\n", err)
			os.Exit(1)
		}
		fmt.Println(owners)
		os.Exit(0)
	}
	if dir := os.Getenv(EnvDir); dir != "" {
		if err := setupDB(dir); err != nil {
			fmt.Fprintf(os.Stderr, "compat: %v\n", err)
			os.Exit(1)
		}
	}
	testsuite.Run(m)
}

func setupDB(dir string) error {
	// MySQL and Postgres would work the same way, but the test infrastructure connects
	// every package to one fixed database name, so packages running in parallel would share
	// a database and break each other. SQLite gets one file per package instead.
	if db := os.Getenv("GRAFANA_TEST_DB"); db != "" && db != "sqlite3" {
		return fmt.Errorf("only sqlite3 is supported, GRAFANA_TEST_DB=%s", db)
	}
	if err := os.MkdirAll(dir, 0o750); err != nil { // #nosec G703 -- test-only directory chosen by whoever runs the tests
		return err
	}
	// go test runs each test binary in its package directory.
	wd, err := os.Getwd()
	if err != nil {
		return err
	}
	// The testinfra SQLite cleanup leaves a file named by SQLITE_TEST_DB in place, and
	// SKIP_DB_TRUNCATE keeps the other version's rows when Grafana starts.
	if err := os.Setenv("SQLITE_TEST_DB", filepath.Join(dir, filepath.Base(wd)+".db")); err != nil {
		return err
	}
	return os.Setenv("SKIP_DB_TRUNCATE", "true")
}

// Dir returns EnvDir, skipping the test when it is unset.
func Dir(t *testing.T) string {
	t.Helper()
	dir := os.Getenv(EnvDir)
	if dir == "" {
		t.Skipf("set %s to run compatibility tests", EnvDir)
	}
	return dir
}

// NewHelper starts Grafana on the shared database. Both versions must start
// with the same storage setup, so every compat package uses this one config.
func NewHelper(t *testing.T) *apis.K8sTestHelper {
	t.Helper()
	Dir(t)
	h := apis.NewK8sTestHelperWithOpts(t, apis.K8sTestHelperOpts{
		GrafanaOpts: testinfra.GrafanaOpts{
			DisableAnonymous:   true,
			EnableSQLKVBackend: true,
			DisableDBCleanup:   true,
		},
		ReuseExistingUsers: true,
	})
	t.Cleanup(h.Shutdown)
	return h
}

// Resource is a namespaced resource this server can create, read, update and delete.
type Resource struct {
	Kind string
	// Versions served for the resource, the group's preferred version first.
	Versions []string
}

var crudVerbs = []string{"create", "get", "list", "update", "delete"}

// Served lists the server's namespaced *.grafana.app resources that support CRUD, by group resource.
// Subresources and resources served without the full verb set are left out.
func Served(t *testing.T, h *apis.K8sTestHelper) map[schema.GroupResource]Resource {
	t.Helper()
	groups, lists, err := h.NewDiscoveryClient().ServerGroupsAndResources()
	require.NoError(t, err)

	byGV := map[string][]metav1.APIResource{}
	for _, l := range lists {
		byGV[l.GroupVersion] = l.APIResources
	}

	out := map[schema.GroupResource]Resource{}
	for _, g := range groups {
		if !strings.HasSuffix(g.Name, ".grafana.app") {
			continue
		}
		// The preferred version can be configured, so it does not have to be the first
		// version discovery lists.
		versions := []metav1.GroupVersionForDiscovery{g.PreferredVersion}
		for _, v := range g.Versions {
			if v.Version != g.PreferredVersion.Version {
				versions = append(versions, v)
			}
		}
		for _, v := range versions {
			for _, r := range byGV[v.GroupVersion] {
				if strings.Contains(r.Name, "/") || !r.Namespaced || !hasVerbs(r.Verbs, crudVerbs) {
					continue
				}
				gr := schema.GroupResource{Group: g.Name, Resource: r.Name}
				res := out[gr]
				res.Kind = r.Kind
				res.Versions = append(res.Versions, v.Version)
				out[gr] = res
			}
		}
	}
	return out
}

func hasVerbs(have []string, want []string) bool {
	for _, w := range want {
		if !slices.Contains(have, w) {
			return false
		}
	}
	return true
}
