package bootstrap

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

func TestValidatePath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{
			name: "an absolute directory",
			path: "/etc/grafana/bootstrap",
		},
		{
			name: "a trailing slash",
			path: "/etc/grafana/bootstrap/",
		},
		{
			name: "a path relative to the home path",
			path: "conf/provisioning/bootstrap",
		},
		{
			name:    "the filesystem root",
			path:    "/",
			wantErr: ErrRootPath,
		},
		{
			name:    "the current directory",
			path:    ".",
			wantErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name:    "a traversal",
			path:    "../../../etc",
			wantErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name:    "a hidden directory",
			path:    "/etc/.grafana/bootstrap",
			wantErr: safepath.ErrHiddenPath,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePath(tt.path)
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}
