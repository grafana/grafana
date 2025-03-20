package safepath

import (
	"errors"
	"strings"
	"testing"
)

func TestValidatePath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{
			name:    "valid path",
			path:    "path/to/resource",
			wantErr: nil,
		},
		{
			name:    "empty path",
			path:    "",
			wantErr: nil,
		},
		{
			name:    "path too long",
			path:    strings.Repeat("a/", 512) + "file", // Creates path > MaxPathLength
			wantErr: ErrPathTooLong,
		},
		{
			name:    "path too deep",
			path:    strings.Repeat("dir/", MaxNestDepth) + "file",
			wantErr: ErrPathTooDeep,
		},
		{
			name:    "path at max depth",
			path:    strings.Repeat("dir/", MaxNestDepth-1),
			wantErr: nil,
		},
		{
			name:    "path at max length",
			path:    strings.Repeat("a", MaxPathLength),
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePath(tt.path)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("ValidatePath() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
