package secrets

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestSecrets_Encrypt(t *testing.T) {
	s := Secrets{
		store: sqlstore.InitTestDB(t),
	}

	require.NoError(t, s.Init())

	{
		old := setting.SecretKey
		defer func() {
			setting.SecretKey = old
		}()
		setting.SecretKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	}

	plaintexts := [][]byte{
		{},
		[]byte("hello, world"),
	}

	for _, plaintext := range plaintexts {
		t.Run(fmt.Sprintf("encrypting and decrypting %s", string(plaintext)), func(t *testing.T) {
			encrypted, err := s.Encrypt(plaintext)
			require.NoError(t, err)
			decrypted, err := s.Decrypt(encrypted)
			require.NoError(t, err)

			assert.Equal(t, plaintext, decrypted)
		})
	}
}
