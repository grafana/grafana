package rbac

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/mappers"
)

func TestService_checkPermission(t *testing.T) {
	type testCase struct {
		name        string
		permissions []accesscontrol.Permission
		check       CheckRequest
		expected    bool
	}

	testCases := []testCase{
		{
			name: "should return true if user has permission",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:some_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "some_dashboard",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return false if user has permission on a different resource",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:another_dashboard",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "another_dashboard",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: false,
		},
		{
			name: "should return true if user has wildcard permission on identifier",
			permissions: []accesscontrol.Permission{
				{
					Action:     "dashboards:read",
					Scope:      "dashboards:uid:*",
					Kind:       "dashboards",
					Attribute:  "uid",
					Identifier: "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if user has wildcard permission on attribute",
			permissions: []accesscontrol.Permission{
				{
					Action:    "dashboards:read",
					Scope:     "dashboards:*",
					Kind:      "dashboards",
					Attribute: "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if user has wildcard permission on kind",
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
					Kind:   "*",
				},
			},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: true,
		},
		{
			name: "should return true if no resource is specified",
			permissions: []accesscontrol.Permission{
				{
					Action: "folders:create",
				},
			},
			check: CheckRequest{
				Action:   "folders:create",
				Group:    "folder.grafana.app",
				Resource: "folders",
			},
			expected: true,
		},
		{
			name:        "should return false if user has no permissions on resource",
			permissions: []accesscontrol.Permission{},
			check: CheckRequest{
				Action:   "dashboards:read",
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "some_dashboard",
			},
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{logger: log.New("test"), actionMapper: mappers.NewK8sRbacMapper()}
			got, err := s.checkPermission(context.Background(), tc.permissions, &tc.check)
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		})
	}
}
