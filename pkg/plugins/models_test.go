package plugins

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRoute_GetReqActions(t *testing.T) {
	tests := []struct {
		name     string
		route    Route
		expected []string
	}{
		{
			name: "single string action",
			route: Route{
				ReqAction: "test.action:read",
			},
			expected: []string{"test.action:read"},
		},
		{
			name: "multiple string actions as array",
			route: Route{
				ReqAction: []string{"test.action:read", "test.action:write"},
			},
			expected: []string{"test.action:read", "test.action:write"},
		},
		{
			name: "multiple any actions",
			route: Route{
				ReqAction: []any{"test.action:read", "test.action:write"},
			},
			expected: []string{"test.action:read", "test.action:write"},
		},
		{
			name: "empty string action",
			route: Route{
				ReqAction: "",
			},
			expected: nil,
		},
		{
			name: "nil action",
			route: Route{
				ReqAction: nil,
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.route.GetReqActions()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRoute_HasReqAction(t *testing.T) {
	tests := []struct {
		name     string
		route    Route
		expected bool
	}{
		{
			name: "has single action",
			route: Route{
				ReqAction: "test.action:read",
			},
			expected: true,
		},
		{
			name: "has multiple actions",
			route: Route{
				ReqAction: []string{"test.action:read", "test.action:write"},
			},
			expected: true,
		},
		{
			name: "empty action",
			route: Route{
				ReqAction: "",
			},
			expected: false,
		},
		{
			name: "nil action",
			route: Route{
				ReqAction: nil,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.route.HasReqAction()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIncludes_GetActions(t *testing.T) {
	tests := []struct {
		name     string
		include  Includes
		expected []string
	}{
		{
			name: "single string action",
			include: Includes{
				Action: "test.action:read",
			},
			expected: []string{"test.action:read"},
		},
		{
			name: "multiple string actions as array",
			include: Includes{
				Action: []string{"test.action:read", "test.action:write"},
			},
			expected: []string{"test.action:read", "test.action:write"},
		},
		{
			name: "multiple any actions",
			include: Includes{
				Action: []any{"test.action:read", "test.action:write"},
			},
			expected: []string{"test.action:read", "test.action:write"},
		},
		{
			name: "empty string action",
			include: Includes{
				Action: "",
			},
			expected: nil,
		},
		{
			name: "nil action",
			include: Includes{
				Action: nil,
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.include.GetActions()
			assert.Equal(t, tt.expected, result)
		})
	}
}

// NOTE: maybe redundant test as the "only" thing the it does is to check the len of GetActions()
//
//	actions := e.GetActions()
//	return len(actions) > 0
func TestIncludes_RequiresRBACActions(t *testing.T) {
	tests := []struct {
		name     string
		include  Includes
		expected bool
	}{
		{
			name: "has single action",
			include: Includes{
				Action: "test.action:read",
			},
			expected: true,
		},
		{
			name: "has multiple actions",
			include: Includes{
				Action: []string{"test.action:read", "test.action:write"},
			},
			expected: true,
		},
		{
			name: "empty action",
			include: Includes{
				Action: "",
			},
			expected: false,
		},
		{
			name: "nil action",
			include: Includes{
				Action: nil,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.include.RequiresRBACActions()
			assert.Equal(t, tt.expected, result)
		})
	}
}
