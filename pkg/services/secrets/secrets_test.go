package secrets

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/encryption"
	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestSecrets_Encrypt(t *testing.T) {
	svc := setupSecretService(t)
	{
		old := setting.SecretKey
		defer func() {
			setting.SecretKey = old
		}()
		setting.SecretKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	}
	// TODO: should be moved to encryption service
	//t.Run("getting encryption key", func(t *testing.T) {
	//	key, err := encryptionKeyToBytes([]byte("secret"), []byte("salt"))
	//	require.NoError(t, err)
	//	assert.Len(t, key, 32)
	//
	//	key, err = encryptionKeyToBytes([]byte("a very long secret key that is larger then 32bytes"), []byte("salt"))
	//	require.NoError(t, err)
	//	assert.Len(t, key, 32)
	//})

	plaintexts := [][]byte{
		[]byte("hello, world"),
		[]byte("grafana"),
	}

	for _, plaintext := range plaintexts {
		t.Run(fmt.Sprintf("encrypting and decrypting %s", string(plaintext)), func(t *testing.T) {
			encrypted, err := svc.Encrypt(plaintext, "")
			require.NoError(t, err)
			decrypted, err := svc.Decrypt(encrypted)
			require.NoError(t, err)

			assert.Equal(t, plaintext, decrypted)
		})
	}

	//// TODO: This test has been moved from util.encryption_test, not sure if Decrypt should work this way
	//t.Run("decrypting empty payload should not fail", func(t *testing.T) {
	//	_, err := s.Decrypt([]byte(""))
	//	require.Error(t, err)
	//
	//	assert.Equal(t, "unable to compute salt", err.Error())
	//})
}

func setupSecretService(t *testing.T) SecretsService {
	t.Helper()
	raw, err := ini.Load([]byte(`
[security]
secret_key = SW2YcwTIb9zpOOhoPsMm
`))
	require.NoError(t, err)
	settings := &setting.OSSImpl{Cfg: &setting.Cfg{Raw: raw}}

	s := SecretsService{
		Store:    sqlstore.InitTestDB(t),
		Enc:      &encryption.OSSEncryptionService{},
		Settings: settings,
	}
	require.NoError(t, s.Init())
	return s
}
