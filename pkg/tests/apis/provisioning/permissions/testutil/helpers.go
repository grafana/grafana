package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var Versions = []string{"v0alpha1", "v1beta1"}
var sequence atomic.Uint64

func Name() string { return fmt.Sprintf("none-%d", sequence.Add(1)) }

func Grant(resource, uid string, actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{Resource: resource, ResourceAttribute: "uid", ResourceID: uid, Actions: actions}
}

func Actions(actions ...string) []resourcepermissions.SetResourcePermissionCommand {
	grouped := map[string][]string{}
	for _, action := range actions {
		resource := strings.Split(action, ":")[0]
		grouped[resource] = append(grouped[resource], action)
	}
	grants := make([]resourcepermissions.SetResourcePermissionCommand, 0, len(grouped))
	for resource, actions := range grouped {
		grants = append(grants, Grant(resource, "*", actions...))
	}
	return grants
}

func None(t *testing.T, h *common.ProvisioningTestHelper, grants ...resourcepermissions.SetResourcePermissionCommand) apis.User {
	t.Helper()
	u := h.CreateUser(Name(), apis.Org1, org.RoleNone, grants)
	// Provisioning fixed roles use empty scopes, which SetResourcePermissionCommand cannot express.
	id, err := u.Identity.GetInternalID() //nolint:staticcheck
	require.NoError(t, err)
	require.NoError(t, h.GetEnv().SQLStore.WithDbSession(t.Context(), func(s *db.Session) error {
		_, err := s.Exec("UPDATE permission SET scope = ?, kind = ?, attribute = ?, identifier = ? WHERE role_id IN (SELECT id FROM role WHERE name = ? AND org_id = ?) AND action LIKE ?", "", "", "", "", accesscontrol.ManagedUserRoleName(id), u.Identity.GetOrgID(), "provisioning.%")
		return err
	}))
	require.Equal(t, org.RoleNone, u.Identity.GetOrgRole())
	require.False(t, u.Identity.GetIsGrafanaAdmin())
	return u
}

type Response struct {
	Code int
	Body []byte
}

func (r Response) Require(t *testing.T, code int) Response {
	t.Helper()
	require.Equal(t, code, r.Code, "%s", r.Body)
	if code == http.StatusForbidden {
		require.Equal(t, float64(http.StatusForbidden), r.Object(t)["code"], "%s", r.Body)
	}
	return r
}

func (r Response) Object(t *testing.T) map[string]any {
	t.Helper()
	var obj map[string]any
	require.NoError(t, json.Unmarshal(r.Body, &obj), "%s", r.Body)
	return obj
}

func JSON(t *testing.T, obj any) []byte {
	t.Helper()
	b, err := json.Marshal(obj)
	require.NoError(t, err)
	return b
}

func Request(t *testing.T, u apis.User, method, path string, body any) Response {
	t.Helper()
	var data []byte
	if body != nil {
		if b, ok := body.([]byte); ok {
			data = b
		} else {
			data = JSON(t, body)
		}
	}
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	cfg := u.NewRestConfig()
	req, err := http.NewRequestWithContext(ctx, method, cfg.Host+path, bytes.NewReader(data))
	require.NoError(t, err)
	req.SetBasicAuth(cfg.Username, cfg.Password)
	req.Header.Set("Content-Type", "application/json")
	if method == http.MethodPatch {
		req.Header.Set("Content-Type", "application/merge-patch+json")
	}
	rsp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, rsp.Body.Close()) }()
	b, err := io.ReadAll(rsp.Body)
	require.NoError(t, err)
	return Response{Code: rsp.StatusCode, Body: b}
}

func Path(version, path string) string {
	return "/apis/provisioning.grafana.app/" + version + "/namespaces/default/" + path
}

func Do(t *testing.T, u apis.User, method, version, path string, body any) Response {
	t.Helper()
	return Request(t, u, method, Path(version, path), body)
}

func Dashboard(uid, title string) map[string]any {
	return map[string]any{"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "Dashboard", "metadata": map[string]any{"name": uid}, "spec": map[string]any{"title": title, "schemaVersion": 39, "panels": []any{}}}
}

func Folder(uid, title string) map[string]any {
	return map[string]any{"apiVersion": "folder.grafana.app/v1beta1", "kind": "Folder", "metadata": map[string]any{"name": uid}, "spec": map[string]any{"title": title}}
}

func Repository(name, path, version string) map[string]any {
	return map[string]any{"apiVersion": "provisioning.grafana.app/" + version, "kind": "Repository", "metadata": map[string]any{"name": name}, "spec": map[string]any{"title": name, "type": "local", "local": map[string]any{"path": path}, "workflows": []string{"write"}, "sync": map[string]any{"enabled": false, "target": "folder", "intervalSeconds": 60}}}
}

func Connection(name, version string) map[string]any {
	return map[string]any{"apiVersion": "provisioning.grafana.app/" + version, "kind": "Connection", "metadata": map[string]any{"name": name}, "spec": map[string]any{"title": name, "type": "githubOAuth", "oauth": map[string]any{"clientID": "test-client"}}, "secure": map[string]any{"clientSecret": map[string]any{"create": "test-client-secret"}}}
}

func Write(t *testing.T, h *common.ProvisioningTestHelper, path string, obj any) {
	t.Helper()
	full := filepath.Join(h.ProvisioningPath, path)
	require.NoError(t, os.MkdirAll(filepath.Dir(full), 0750))
	var data []byte
	if b, ok := obj.([]byte); ok {
		data = b
	} else {
		data = JSON(t, obj)
	}
	require.NoError(t, os.WriteFile(full, data, 0600))
}

func LocalRepo(t *testing.T, h *common.ProvisioningTestHelper, target string) string {
	t.Helper()
	name := Name()
	h.CreateLocalRepo(t, common.TestRepo{Name: name, SyncTarget: target, Workflows: []string{"write"}})
	return name
}
