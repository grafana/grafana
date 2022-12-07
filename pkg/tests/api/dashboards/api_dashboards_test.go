package dashboards

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/api/apitest"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestDashboardQuota(t *testing.T) {
	// enable quota and set low dashboard quota
	// Setup Grafana and its Database
	dashboardQuota := int64(1)
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous:  true,
		EnableQuota:       true,
		DashboardOrgQuota: &dashboardQuota,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// Create user
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apitest.TestAPI(t, fmt.Sprintf(`
env:
  baseURL: http://admin:admin@%s
steps:
  - name: when quota limit doesn't exceed, importing a dashboard should succeed
    method: POST
    url: "{{.baseURL}}/api/dashboards/import"
    body:
      dashboard:
        title: just testing
    checks:
      status: 200
      body:
        '$.dashboardId': 1

  - name: when quota limit exceeds importing a dashboard should fail
    method: POST
    url: "{{.baseURL}}/api/dashboards/import"
    body:
      dashboard:
        title: just testing
    checks:
      status: 403
      body:
        '$.message': "Quota reached"
`, grafanaListedAddr))
}

func createUser(t *testing.T, store *sqlstore.SQLStore, cmd user.CreateUserCommand) int64 {
	t.Helper()

	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = 1

	u, err := store.CreateUser(context.Background(), cmd)
	require.NoError(t, err)
	return u.ID
}

func TestUpdatingProvisionionedDashboards(t *testing.T) {
	// Setup Grafana and its Database
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	provDashboardsDir := filepath.Join(dir, "conf", "provisioning", "dashboards")
	provDashboardsCfg := filepath.Join(provDashboardsDir, "dev.yaml")
	blob := []byte(fmt.Sprintf(`
apiVersion: 1

providers:
- name: 'provisioned dashboards'
  type: file
  allowUiUpdates: false
  options:
   path: %s`, provDashboardsDir))
	err := os.WriteFile(provDashboardsCfg, blob, 0644)
	require.NoError(t, err)
	input, err := os.ReadFile(filepath.Join("./home.json"))
	require.NoError(t, err)
	provDashboardFile := filepath.Join(provDashboardsDir, "home.json")
	err = os.WriteFile(provDashboardFile, input, 0644)
	require.NoError(t, err)
	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)
	// Create user
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	apitest.TestAPI(t, fmt.Sprintf(`
env:
  baseURL: http://admin:admin@%s
steps:
  - name: when provisioned directory is not empty, dashboard should be created
    url: "{{.baseURL}}/api/search?query=Grafana%%20Dev%%20Overview%%20%%26%%20Home"
    body: {dashboard: {title: just testing}}
    checks:
      status: 200
      body:
        '$.[0].id': 1
      captures:
        'uid': '$.[0].uid'

  - name: when updating provisioned dashboard using ID it should fail
    method: POST
    url: "{{.baseURL}}/api/dashboards/db"
    body: { dashboard: { title: just testing, id: 1, version: 1 } }
    checks: { status: 400 }

  - name: when updating provisioned dashboard using UID it should fail
    method: POST
    url: "{{.baseURL}}/api/dashboards/db"
    body: { dashboard: { title: just testing, uid: "{{.uid}}", version: 1 } }
    checks: { status: 400 }

  - name: when updating dashboard using unknown ID, it should fail
    method: POST
    url: "{{.baseURL}}/api/dashboards/db"
    body: { dashboard: { title: just testing, id: 42, version: 1} }
    checks: { status: 404 }

  - name: when updating dashboard using unknown UID, it should succeed
    method: POST
    url: "{{.baseURL}}/api/dashboards/db"
    body: { dashboard: { title: just testing, uid: "unknown", version: 1} }
    checks: { status: 200 }

  - name: deleting provisioned dashboard should fail
    method: DELETE
    url: "{{.baseURL}}/api/dashboards/uid/{{.uid}}"
    checks: { status: 400 }
`, grafanaListedAddr))
}
