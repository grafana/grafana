package satokengen

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApiKeyValidation(t *testing.T) {
	result := KeyGenResult{
		ClientSecret: "glsa_yscW25imSKJIuav8zF37RZmnbiDvB05G_fcaaf58a",
		HashedKey:    "26cd2524985150529dc5f32109f544860512b999766e11bc8f3d5711bf0ba6e7020099f9f21538b5df94d577782f7431dd27",
	}

	keyInfo, err := Decode(result.ClientSecret)
	require.NoError(t, err)
	require.Equal(t, "sa", keyInfo.ServiceID)
	require.Equal(t, "yscW25imSKJIuav8zF37RZmnbiDvB05G", keyInfo.Secret)
	require.Equal(t, "fcaaf58a", keyInfo.Checksum)

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
