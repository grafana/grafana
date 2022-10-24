package provider

import (
	"github.com/grafana/grafana/pkg/services/encryption"
)

type Provider struct{}

func ProvideEncryptionProvider() Provider {
	return Provider{}
}

func (p Provider) ProvideCiphers() map[string]encryption.Cipher {
	return map[string]encryption.Cipher{
		encryption.AesCfb: aesCfbCipher{},
	}
}

func (p Provider) ProvideDeciphers() map[string]encryption.Decipher {
	return map[string]encryption.Decipher{
		encryption.AesCfb: aesDecipher{algorithm: encryption.AesCfb},
		encryption.AesGcm: aesDecipher{algorithm: encryption.AesGcm},
	}
}
