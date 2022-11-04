package client

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/client/clienttest"
	"github.com/stretchr/testify/require"
)

func TestReverseMiddlewares(t *testing.T) {
	t.Run("Should reverse 1 middleware", func(t *testing.T) {
		middlewares := []plugins.ClientMiddleware{
			clienttest.NewMiddleware("mw1"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 1)
		require.Equal(t, "mw1", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 2 middlewares", func(t *testing.T) {
		middlewares := []plugins.ClientMiddleware{
			clienttest.NewMiddleware("mw1"),
			clienttest.NewMiddleware("mw2"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 2)
		require.Equal(t, "mw2", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 3 middlewares", func(t *testing.T) {
		middlewares := []plugins.ClientMiddleware{
			clienttest.NewMiddleware("mw1"),
			clienttest.NewMiddleware("mw2"),
			clienttest.NewMiddleware("mw3"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 3)
		require.Equal(t, "mw3", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[2].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})

	t.Run("Should reverse 4 middlewares", func(t *testing.T) {
		middlewares := []plugins.ClientMiddleware{
			clienttest.NewMiddleware("mw1"),
			clienttest.NewMiddleware("mw2"),
			clienttest.NewMiddleware("mw3"),
			clienttest.NewMiddleware("mw4"),
		}
		reversed := reverseMiddlewares(middlewares)
		require.Len(t, reversed, 4)
		require.Equal(t, "mw4", reversed[0].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw3", reversed[1].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw2", reversed[2].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
		require.Equal(t, "mw1", reversed[3].CreateClientMiddleware(nil).(*clienttest.TestMiddleware).Name)
	})
}
