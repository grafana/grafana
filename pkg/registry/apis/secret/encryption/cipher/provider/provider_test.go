package provider_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher/provider"
	"github.com/stretchr/testify/require"
)

func TestNoCfbEncryptionCipher(t *testing.T) {
	// CFB encryption is insecure, and as such we should not permit any cipher for encryption to be added.
	// Changing/removing this test MUST be accompanied with an approval from the app security team.

	ciphers := provider.ProvideCiphers()
	require.NotContains(t, ciphers, cipher.AesCfb, "CFB cipher should not be used for encryption")
}
