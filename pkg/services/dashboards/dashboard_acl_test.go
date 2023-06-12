package dashboards

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPermissionType_String(t *testing.T) {
	testCases := []struct {
		permissionType PermissionType
		expected       string
	}{
		{PERMISSION_ADMIN, "Admin"},
		{PERMISSION_EDIT, "Edit"},
		{PERMISSION_VIEW, "View"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			assert.Equal(t, tc.expected, fmt.Sprint(tc.permissionType))
			assert.Equal(t, tc.expected, tc.permissionType.String())
		})
	}
}
