package pluginproxy

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInterpolateString(t *testing.T) {
	data := templateData{
		SecureJsonData: map[string]string{
			"Test": "0asd+asd",
		},
	}

	interpolated, err := interpolateString("{{.SecureJsonData.Test}}", data)
	require.NoError(t, err)
	assert.Equal(t, "0asd+asd", interpolated)
}
