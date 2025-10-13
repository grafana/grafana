package client

import (
	"context"
	"net/http"
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
		require.Equal(t, http.Header{"Foo": []string{"bar"}}, opts.Header)
		require.Equal(t, 1, len(opts.Middlewares))
	})
}
