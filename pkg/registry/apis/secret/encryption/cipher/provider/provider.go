package provider

import (
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type Provider struct{}

func ProvideEncryptionProvider() Provider {
	return Provider{}
}

func (p Provider) ProvideCiphers() map[string]cipher.Encrypter {
	return map[string]cipher.Encrypter{
		cipher.AesCfb: aesCfbCipher{},
	}
}

func (p Provider) ProvideDeciphers() map[string]cipher.Decrypter {
	return map[string]cipher.Decrypter{
		cipher.AesCfb: aesDecipher{algorithm: cipher.AesCfb},
		cipher.AesGcm: aesDecipher{algorithm: cipher.AesGcm},
	}
}
