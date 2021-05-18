package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetBasicAuthHeader_Encoding(t *testing.T) {
	t.Run("generating base64 header", func(t *testing.T) {
		result := GetBasicAuthHeader("grafana", "1234")
		assert.Equal(t, "Basic Z3JhZmFuYToxMjM0", result)
	})

	t.Run("decoding basic auth header", func(t *testing.T) {
		header := GetBasicAuthHeader("grafana", "1234")
		username, password, err := DecodeBasicAuthHeader(header)
		require.NoError(t, err)

		assert.Equal(t, "grafana", username)
		assert.Equal(t, "1234", password)
	})
}

func TestEncodePassword(t *testing.T) {
	encodedPassword, err := EncodePassword("iamgod", "pepper")
	require.NoError(t, err)
	assert.Equal(
		t,
		"e59c568621e57756495a468f47c74e07c911b037084dd464bb2ed72410970dc849cabd71b48c394faf08a5405dae53741ce9",
		encodedPassword,
	)
}
