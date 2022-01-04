package client

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestForceGet(t *testing.T) {
	t.Run("With nil jsonOpts, should not force get-method", func(t *testing.T) {
		var jsonOpts map[string]interface{}
		require.False(t, shouldForceGet(jsonOpts))
	})

	t.Run("With empty jsonOpts, should not force get-method", func(t *testing.T) {
		jsonOpts := make(map[string]interface{})
		require.False(t, shouldForceGet(jsonOpts))
	})

	t.Run("With httpMethod=nil, should not not force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": nil,
		}
		require.False(t, shouldForceGet(jsonOpts))
	})

	t.Run("With httpMethod=post, should not force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "POST",
		}
		require.False(t, shouldForceGet(jsonOpts))
	})

	t.Run("With httpMethod=get, should force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "get",
		}
		require.True(t, shouldForceGet(jsonOpts))
	})

	t.Run("With httpMethod=GET, should force get-method", func(t *testing.T) {
		jsonOpts := map[string]interface{}{
			"httpMethod": "GET",
		}
		require.True(t, shouldForceGet(jsonOpts))
	})
}
