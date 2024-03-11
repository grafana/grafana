package client

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestCreateTransportOptions(t *testing.T) {
	t.Run("creates correct options object", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			BasicAuthEnabled: false,
			BasicAuthUser:    "",
			JSONData:         []byte(`{"httpHeaderName1": "foo"}`),
			DecryptedSecureJSONData: map[string]string{
				"httpHeaderValue1": "bar",
			},
		}
		opts, err := CreateTransportOptions(context.Background(), settings, backend.NewLoggerWith("logger", "test"))
		require.NoError(t, err)
		require.Equal(t, map[string]string{"foo": "bar"}, opts.Headers)
		require.Equal(t, 2, len(opts.Middlewares))
	})
}
