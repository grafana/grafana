package provider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_aesCfbCipher(t *testing.T) {
	cipher := aesCfbCipher{}
	ctx := context.Background()

	encrypted, err := cipher.Encrypt(ctx, []byte("grafana"), "1234")
	require.NoError(t, err)
	assert.NotNil(t, encrypted)
	assert.NotEmpty(t, encrypted)
}
