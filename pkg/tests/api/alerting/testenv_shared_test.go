package alerting

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// sharedEnv holds a single Grafana server shared across alerting integration
// tests that use the same GrafanaOpts. Tests access it via getStandardSharedEnv.
//
// NOTE: This replicates the SharedEnv pattern from
// pkg/tests/apis/provisioning/common/testing.go, which is domain-specific
// (wraps ProvisioningTestHelper) and cannot be used here directly. A generic
// version should eventually be extracted into testinfra and used by both.
var (
	standardOnce          sync.Once
	standardEnvAddr       string
	standardEnvServer     *server.TestEnv
	standardEnvShutdownFn func()
	standardEnvInitErr    string
	standardGrafanaUserID int64
)

// getStandardSharedEnv returns the shared Grafana server for tests using
// standard opts. The server is started on the first call and reused for all
// subsequent calls. The test is fataled with a clear message if init fails.
func getStandardSharedEnv(t *testing.T) (string, *server.TestEnv) {
	t.Helper()
	standardOnce.Do(func() {
		defer func() {
			if r := recover(); r != nil {
				standardEnvInitErr = fmt.Sprintf("shared env init panicked: %v", r)
			} else if standardEnvServer == nil && standardEnvInitErr == "" {
				standardEnvInitErr = "shared env init failed (FailNow/Goexit called; see first test output)"
			}
		}()
		dir, path := testinfra.CreateGrafDirShared(t, testinfra.GrafanaOpts{
			DisableLegacyAlerting: true,
			EnableUnifiedAlerting: true,
			DisableAnonymous:      true,
			AppModeProduction:     true,
		})
		var shutdown func()
		standardEnvAddr, standardEnvServer, _, shutdown = testinfra.StartGrafanaEnvWithManualCleanup(t, dir, path)
		standardEnvShutdownFn = func() {
			shutdown()
			_ = os.RemoveAll(dir)
		}
		standardGrafanaUserID = createUser(t, standardEnvServer.SQLStore, standardEnvServer.Cfg, user.CreateUserCommand{
			DefaultOrgRole: string(org.RoleEditor),
			Password:       "password",
			Login:          "grafana",
		})
	})
	if standardEnvInitErr != "" {
		t.Fatalf("%s", standardEnvInitErr)
	}
	return standardEnvAddr, standardEnvServer
}

// deleteFolder deletes a Grafana folder and all alert rules inside it.
// Uses admin credentials to bypass any folder-level RBAC restrictions.
func deleteFolder(t *testing.T, addr, folderUID string) {
	t.Helper()
	u := fmt.Sprintf("http://admin:admin@%s/api/folders/%s?forceDeleteRules=true", addr, folderUID)
	req, err := http.NewRequest(http.MethodDelete, u, nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	_ = resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode, "deleteFolder %s failed", folderUID)
}
