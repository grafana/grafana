package repository

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestClientCheckBranchProtection(t *testing.T) {
	tests := []struct {
		name      string
		client    func(*testing.T) BranchProtectionClient
		protected bool
		err       error
	}{
		{
			name: "nil client",
			client: func(*testing.T) BranchProtectionClient {
				return nil
			},
		},
		{
			name: "protected",
			client: func(t *testing.T) BranchProtectionClient {
				client := NewMockBranchProtectionClient(t)
				client.EXPECT().CheckBranchProtection(mock.Anything, "main").Return(true, nil)
				return client
			},
			protected: true,
		},
		{
			name: "permission denied",
			client: func(t *testing.T) BranchProtectionClient {
				client := NewMockBranchProtectionClient(t)
				client.EXPECT().CheckBranchProtection(mock.Anything, "main").Return(false, ErrPermissionDenied)
				return client
			},
		},
		{
			name: "error",
			client: func(t *testing.T) BranchProtectionClient {
				client := NewMockBranchProtectionClient(t)
				client.EXPECT().CheckBranchProtection(mock.Anything, "main").Return(false, errors.New("failed"))
				return client
			},
			err: errors.New("failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			protected, err := ClientCheckBranchProtection(t.Context(), tt.client(t), "main")
			require.Equal(t, tt.protected, protected)
			require.Equal(t, tt.err, err)
		})
	}
}
