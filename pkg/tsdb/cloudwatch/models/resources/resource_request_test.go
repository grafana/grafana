package resources

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResourceRequest(t *testing.T) {
	t.Run("Should return an error if region is not provided", func(t *testing.T) {
		request, err := GetDimensionValuesRequest(map[string][]string{})
		require.Empty(t, request)
		assert.Equal(t, "region is required", err.Error())
	})
}
