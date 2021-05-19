package tempo

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTempo(t *testing.T) {
	plug, err := New(httpclient.NewProvider())(&models.DataSource{})
	executor := plug.(*tempoExecutor)
	require.NoError(t, err)

	t.Run("createRequest should set Auth header when basic auth is true ", func(t *testing.T) {
		req, err := executor.createRequest(context.Background(), &models.DataSource{BasicAuth: true, BasicAuthUser: "john", BasicAuthPassword: "pass"}, "traceID")
		require.NoError(t, err)
		assert.Equal(t, 2, len(req.Header))
		assert.NotEqual(t, req.Header.Get("Authorization"), "")
	})
}
