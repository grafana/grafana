package secrets

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryption_keyDerivationLength(t *testing.T) {
	salt := []byte("salt")

	tests := []struct {
		secret []byte
		salt   []byte
	}{
		{[]byte("secret"), salt},
		{[]byte("a very long secret key that is larger then 32bytes"), salt},
	}

	for i, tc := range tests {
		tc := tc
		t.Run(fmt.Sprintf("deriving key #%d", i), func(t *testing.T) {
			key, err := encryptionKeyToBytes(tc.secret, tc.salt)
			require.NoError(t, err)
			assert.Len(t, key, 32)
		})
	}
}

func TestEncryption_basic(t *testing.T) {
	encrypted, err := encrypt([]byte("grafana"), []byte("1234"))
	require.NoError(t, err)

	decrypted, err := decrypt(encrypted, []byte("1234"))
	require.NoError(t, err)

	assert.Equal(t, []byte("grafana"), decrypted)
}
