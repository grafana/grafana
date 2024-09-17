package store

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetDbStoragePathPrefix(t *testing.T) {
	tests := []struct {
		orgId       int64
		storageName string
		expected    string
	}{
		{
			orgId:       124,
			storageName: "long-storage-name",
			expected:    "/124/long-storage-name/",
		},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("orgId: %d, storageName: %s", tt.orgId, tt.storageName), func(t *testing.T) {
			assert.Equal(t, tt.expected, getDbStoragePathPrefix(tt.orgId, tt.storageName))
		})
	}
}
