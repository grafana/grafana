package accesscontrol

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/errutil"
)

func TestIsAuthorizationError(t *testing.T) {
	testCases := []struct {
		name     string
		err      error
		expected bool
	}{
		{
			name:     "false when nil",
			err:      nil,
			expected: false,
		},
		{
			name:     "false when a regular error",
			err:      errors.New("test"),
			expected: false,
		},
		{
			name:     "false when a errutil.Error but message Id is different",
			err:      errutil.NewBase(errutil.CoreStatus("test"), "test"),
			expected: false,
		},
		{
			name:     "true when a authz error",
			err:      NewAuthorizationErrorGeneric("test"),
			expected: true,
		},
		{
			name:     "true when a authz error in chain",
			err:      fmt.Errorf("test: %w", NewAuthorizationErrorGeneric("test")),
			expected: true,
		},
		{
			name:     "true when a authz error in join",
			err:      errors.Join(errors.New("test"), fmt.Errorf("test: %w", NewAuthorizationErrorGeneric("test"))),
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, IsAuthorizationError(tc.err))
		})
	}
}
