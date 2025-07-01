package provider

import (
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
)

func ProvideCiphers() map[string]cipher.Encrypter {
	return map[string]cipher.Encrypter{
		cipher.AesGcm: newAesGcmCipher(),
	}
}

func ProvideDeciphers() map[string]cipher.Decrypter {
	return map[string]cipher.Decrypter{
		cipher.AesGcm: newAesGcmCipher(),
		cipher.AesCfb: aesCfbDecipher{},
	}
}
