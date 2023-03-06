package tempo

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTempo(t *testing.T) {
	t.Run("createRequest without time range - success", func(t *testing.T) {
		service := &Service{tlog: log.New("tempo-test")}
		req, err := service.createRequest(context.Background(), &datasourceInfo{}, "traceID", 0, 0)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
	})

	t.Run("createRequest with time range - success", func(t *testing.T) {
		service := &Service{tlog: log.New("tempo-test")}
		req, err := service.createRequest(context.Background(), &datasourceInfo{}, "traceID", 1, 2)
		require.NoError(t, err)
		assert.Equal(t, 1, len(req.Header))
		assert.Equal(t, "/api/traces/traceID?start=1&end=2", req.URL.String())
	})
}
