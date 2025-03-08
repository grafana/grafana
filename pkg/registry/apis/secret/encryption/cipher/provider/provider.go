package provider

import (
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type Provider struct{}

func ProvideEncryptionProvider() Provider {
	return Provider{}
}

func (p Provider) ProvideCiphers() map[string]cipher.Cipher {
	return map[string]cipher.Cipher{
		cipher.AesCfb: aesCfbCipher{},
	}
}

func (p Provider) ProvideDeciphers() map[string]cipher.Decipher {
	return map[string]cipher.Decipher{
		cipher.AesCfb: aesDecipher{algorithm: cipher.AesCfb},
		cipher.AesGcm: aesDecipher{algorithm: cipher.AesGcm},
	}
}
