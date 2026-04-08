package authorizer

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePermission(t *testing.T) {
	v := &RolePermissionValidator{}

	tests := []struct {
		name        string
		action      string
		scope       string
		wantK8s     bool
		wantGroup   string
		wantRes     string
		wantVerb    string
		wantName    string
		wantFolder  bool
		wantErr     bool
		errContains string
	}{
		{
			name:     "legacy action no scope",
			action:   "dashboards:read",
			wantK8s:  false,
			wantRes:  "dashboards",
			wantVerb: "read",
		},
		{
			name:      "grafana.app k8s action",
			action:    "dashboard.grafana.app/dashboards:get",
			wantK8s:   true,
			wantGroup: "dashboard.grafana.app",
			wantRes:   "dashboards",
			wantVerb:  "get",
		},
		{
			name:      "ext.grafana.com k8s action",
			action:    "myapp.ext.grafana.com/things:get",
			wantK8s:   true,
			wantGroup: "myapp.ext.grafana.com",
			wantRes:   "things",
			wantVerb:  "get",
		},
		{
			name:      "grafana.com k8s action",
			action:    "myapp.grafana.com/things:get",
			wantK8s:   true,
			wantGroup: "myapp.grafana.com",
			wantRes:   "things",
			wantVerb:  "get",
		},
		{
			name:      "plugins.grafana.com k8s action",
			action:    "myplugin.plugins.grafana.com/things:get",
			wantK8s:   true,
			wantGroup: "myplugin.plugins.grafana.com",
			wantRes:   "things",
			wantVerb:  "get",
		},
		{
			name:       "folder scope wildcard",
			action:     "dashboards:read",
			scope:      "folders:*",
			wantRes:    "dashboards",
			wantVerb:   "read",
			wantFolder: true,
			wantName:   "*",
		},
		{
			name:     "uid scope",
			action:   "dashboards:read",
			scope:    "dashboards:uid:abc",
			wantRes:  "dashboards",
			wantVerb: "read",
			wantName: "abc",
		},
		{
			name:        "invalid k8s domain",
			action:      "myapp.invalid.com/things:get",
			wantErr:     true,
			errContains: "invalid K8s action format",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			perm, err := v.parsePermission(tc.action, tc.scope)
			if tc.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errContains)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantK8s, perm.k8sPermission)
			assert.Equal(t, tc.wantGroup, perm.action.group)
			assert.Equal(t, tc.wantRes, perm.action.resource)
			assert.Equal(t, tc.wantVerb, perm.action.verb)
			assert.Equal(t, tc.wantName, perm.scope.name)
			assert.Equal(t, tc.wantFolder, perm.scope.folder)
		})
	}
}
