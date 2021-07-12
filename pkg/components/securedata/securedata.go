package securedata

import (
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type SecureData []byte

func Encrypt(data []byte) (SecureData, error) {
	return util.Encrypt(data, setting.SecretKey, setting.EncryptionAlgorithm)
}

func (s SecureData) Decrypt() ([]byte, error) {
	return util.Decrypt(s, setting.SecretKey, setting.EncryptionAlgorithm)
}
