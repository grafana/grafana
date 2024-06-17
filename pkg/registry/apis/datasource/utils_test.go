package datasource

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

func Test_panicGuard(t *testing.T) {
	t.Run("runs a function", func(t *testing.T) {
		logger := log.New()
		f := func() (*backend.CheckHealthResult, error) {
			return &backend.CheckHealthResult{
				Status: backend.HealthStatusOk,
			}, nil
		}
		r, err := panicGuard(logger, f)
		require.NoError(t, err)
		require.Equal(t, backend.HealthStatusOk, r.Status)
	})

	t.Run("recovers from a panic", func(t *testing.T) {
		logger := log.New()
		f := func() (*backend.CheckHealthResult, error) {
			panic("oh no")
		}
		r, err := panicGuard(logger, f)
		require.Error(t, err)
		require.Nil(t, r)
	})
}
