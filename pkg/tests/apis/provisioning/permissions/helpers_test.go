package permissions

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const apiVersion = "provisioning.grafana.app/v1beta1"

var env = common.NewSharedEnv(common.WithConnectionTypes([]string{"githubOAuth"}), func(o *testinfra.GrafanaOpts) {
	// Exercise request authorization without running asynchronous jobs or reconciliation.
	o.DisableControllers = true
	o.DisableAnonymous = true
	// Each request must evaluate the shared user's newly assigned grants.
	o.DisableAuthZClientCache = true
})

func TestMain(m *testing.M) { env.RunTestMain(m) }

func setPermissions(t *testing.T, h *common.ProvisioningTestHelper, u apis.User, actions []string) {
	t.Helper()
	require.Equal(t, org.RoleNone, u.Identity.GetOrgRole())
	require.False(t, u.Identity.GetIsGrafanaAdmin())
	id, err := u.Identity.GetInternalID() //nolint:staticcheck
	require.NoError(t, err)
	roleName := accesscontrol.ManagedUserRoleName(id)
	// Replace the shared user's grants so earlier cases cannot authorize later requests.
	require.NoError(t, h.GetEnv().SQLStore.WithDbSession(t.Context(), func(s *db.Session) error {
		_, err := s.Exec("DELETE FROM permission WHERE role_id IN (SELECT id FROM role WHERE name = ? AND org_id = ?)", roleName, u.Identity.GetOrgID())
		return err
	}))
	grouped := map[string][]string{}
	for _, action := range actions {
		resource := strings.Split(action, ":")[0]
		grouped[resource] = append(grouped[resource], action)
	}
	grants := make([]resourcepermissions.SetResourcePermissionCommand, 0, len(grouped))
	for resource, actions := range grouped {
		grants = append(grants, resourcepermissions.SetResourcePermissionCommand{
			Resource: resource, ResourceAttribute: "uid", ResourceID: "*", Actions: actions,
		})
	}
	h.SetPermissions(u, grants)
	// Provisioning fixed roles have empty scopes, which the resource-permission fixture cannot express.
	require.NoError(t, h.GetEnv().SQLStore.WithDbSession(t.Context(), func(s *db.Session) error {
		_, err := s.Exec("UPDATE permission SET scope = ?, kind = ?, attribute = ?, identifier = ? WHERE role_id IN (SELECT id FROM role WHERE name = ? AND org_id = ?) AND action LIKE ?", "", "", "", "", roleName, u.Identity.GetOrgID(), "provisioning.%")
		return err
	}))
}

func request(t *testing.T, u apis.User, method, path string, body any, status int) []byte {
	t.Helper()
	var data []byte
	if body != nil {
		var err error
		data, err = json.Marshal(body)
		require.NoError(t, err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	cfg := u.NewRestConfig()
	req, err := http.NewRequestWithContext(ctx, method, cfg.Host+"/apis/"+apiVersion+"/namespaces/default/"+path, bytes.NewReader(data))
	require.NoError(t, err)
	req.SetBasicAuth(cfg.Username, cfg.Password)
	req.Header.Set("Content-Type", "application/json")
	if method == http.MethodPatch {
		req.Header.Set("Content-Type", "application/merge-patch+json")
	}
	rsp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, rsp.Body.Close()) }()
	response, err := io.ReadAll(rsp.Body)
	require.NoError(t, err)
	require.Equal(t, status, rsp.StatusCode, "%s", response)
	return response
}

func repository(t *testing.T, h *common.ProvisioningTestHelper, name, path string) map[string]any {
	t.Helper()
	repo := h.RenderObject(t, common.TestdataPath("local.json.tmpl"), common.TestRepo{
		Name: name, Path: path, SyncEnabled: true, SyncTarget: "folderless", WorkflowsJSON: `["write"]`,
	})
	repo.SetAPIVersion(apiVersion)
	return repo.Object
}

func connection(name string) map[string]any {
	conn := common.NewGithubOAuthConnection(name, "test-client")
	conn.SetAPIVersion(apiVersion)
	return conn.Object
}

func dashboard(name string) map[string]any {
	return map[string]any{"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "Dashboard", "metadata": map[string]any{"name": name}, "spec": map[string]any{"title": name, "schemaVersion": 39, "panels": []any{}}}
}
