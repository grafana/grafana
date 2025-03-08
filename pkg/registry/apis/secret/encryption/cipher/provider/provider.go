package provider

import (
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

type provider struct{}

func NewEncryptionProvider() provider {
	return provider{}
}

func (p provider) ProvideCiphers() map[string]cipher.Encrypter {
	return map[string]cipher.Encrypter{
		cipher.AesCfb: aesCfbCipher{},
	}
}

func (p provider) ProvideDeciphers() map[string]cipher.Decrypter {
	return map[string]cipher.Decrypter{
		cipher.AesCfb: aesDecipher{algorithm: cipher.AesCfb},
		cipher.AesGcm: aesDecipher{algorithm: cipher.AesGcm},
	}
}
