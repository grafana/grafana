package tempo

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTempo(t *testing.T) {
	t.Run("createRequest - success", func(t *testing.T) {
		service := &Service{}
		req, err := service.createRequest(context.Background(), &datasourceInfo{}, "traceID")
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
	})
}
