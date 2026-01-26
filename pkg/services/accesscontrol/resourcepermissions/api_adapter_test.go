package resourcepermissions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// TestGetPermissionKind tests the permission kind mapping logic
func TestGetPermissionKind(t *testing.T) {
	api := &api{
		service: &Service{
			options: Options{
				Resource:          "dashboards",
				ResourceAttribute: "uid",
			},
		},
	}

	tests := []struct {
		name     string
		perm     accesscontrol.SetResourcePermissionCommand
		expected string
	}{
		{
			name:     "user permission",
			perm:     accesscontrol.SetResourcePermissionCommand{UserID: 123},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindUser),
		},
		{
			name:     "team permission",
			perm:     accesscontrol.SetResourcePermissionCommand{TeamID: 456},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindTeam),
		},
		{
			name:     "builtin role permission",
			perm:     accesscontrol.SetResourcePermissionCommand{BuiltinRole: "Editor"},
			expected: string(iamv0.ResourcePermissionSpecPermissionKindBasicRole),
		},
		{
			name:     "empty permission returns empty kind",
			perm:     accesscontrol.SetResourcePermissionCommand{},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kind := api.getPermissionKind(tt.perm)
			assert.Equal(t, tt.expected, kind)
		})
	}
}

// TestGetDynamicClient_RestConfigNotAvailable tests error handling when rest config is not available
func TestGetDynamicClient_RestConfigNotAvailable(t *testing.T) {
	ctx := context.Background()

	api := &api{
		service: &Service{
			options: Options{
				Resource: "dashboards",
			},
		},
		restConfigProvider: nil,
	}

	client, err := api.getDynamicClient(ctx)

	assert.Error(t, err)
	assert.Nil(t, client)
	assert.Equal(t, ErrRestConfigNotAvailable, err)
}

// TestBuildResourcePermissionName tests resource permission name building
func TestBuildResourcePermissionName(t *testing.T) {
	tests := []struct {
		name         string
		apiGroup     string
		resource     string
		resourceID   string
		expectedName string
	}{
		{
			name:         "with custom API group",
			apiGroup:     "dashboard.grafana.app",
			resource:     "dashboards",
			resourceID:   "dashboard-uid-123",
			expectedName: "dashboard.grafana.app-dashboards-dashboard-uid-123",
		},
		{
			name:         "with default API group",
			apiGroup:     "",
			resource:     "folders",
			resourceID:   "folder-uid-456",
			expectedName: "folders.grafana.app-folders-folder-uid-456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			api := &api{
				service: &Service{
					options: Options{
						Resource: tt.resource,
						APIGroup: tt.apiGroup,
					},
				},
			}

			name := api.buildResourcePermissionName(tt.resourceID)
			assert.Equal(t, tt.expectedName, name)
		})
	}
}

// TestGetAPIGroup tests API group resolution
func TestGetAPIGroup(t *testing.T) {
	t.Run("returns custom API group when set", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "dashboards",
					APIGroup: "custom.grafana.app",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "custom.grafana.app", group)
	})

	t.Run("returns default API group when not set", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "dashboards",
					APIGroup: "",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "dashboards.grafana.app", group)
	})

	t.Run("default group for folders", func(t *testing.T) {
		api := &api{
			service: &Service{
				options: Options{
					Resource: "folders",
					APIGroup: "",
				},
			},
		}

		group := api.getAPIGroup()
		assert.Equal(t, "folders.grafana.app", group)
	})
}

// TestResourcePermissionKindConstants verifies the kind constants match expected values
func TestResourcePermissionKindConstants(t *testing.T) {
	tests := []struct {
		name     string
		kind     iamv0.ResourcePermissionSpecPermissionKind
		expected string
	}{
		{
			name:     "User kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindUser,
			expected: "User",
		},
		{
			name:     "Team kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindTeam,
			expected: "Team",
		},
		{
			name:     "ServiceAccount kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindServiceAccount,
			expected: "ServiceAccount",
		},
		{
			name:     "BasicRole kind",
			kind:     iamv0.ResourcePermissionSpecPermissionKindBasicRole,
			expected: "BasicRole",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, string(tt.kind))
		})
	}
}
