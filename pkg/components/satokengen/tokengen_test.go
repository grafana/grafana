package satokengen

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApiKeyValidation(t *testing.T) {
	result := KeyGenResult{
		ClientSecret: "glsa_iNValIdinValiDinvalidinvalidinva_5b582697",
		HashedKey:    "c59a6e547944ef768df51d1fc8b2a9810bc777a0bd2e5daa9ef8590f300c884e0ab9470c22c6f789414fdb6485b531166ded",
	}

	keyInfo, err := Decode(result.ClientSecret)
	require.NoError(t, err)
	require.Equal(t, "sa", keyInfo.ServiceID)
	require.Equal(t, "iNValIdinValiDinvalidinvalidinva", keyInfo.Secret)
	require.Equal(t, "5b582697", keyInfo.Checksum)

	hash, err := keyInfo.Hash()
	require.NoError(t, err)
	require.Equal(t, result.HashedKey, hash)
}

func TestApiKeyGen(t *testing.T) {
	result, err := New("sa")
	require.NoError(t, err)

	assert.NotEmpty(t, result.ClientSecret)
	assert.NotEmpty(t, result.HashedKey)

	keyInfo, err := Decode(result.ClientSecret)
	require.NoError(t, err)

	hash, err := keyInfo.Hash()
	require.NoError(t, err)
	require.Equal(t, result.HashedKey, hash)
}
