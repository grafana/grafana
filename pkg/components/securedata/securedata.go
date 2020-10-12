package securedata

import (
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type SecureData []byte

func EncryptAndEncode(data []byte) (SecureData, error) {
	return util.Encrypt(data, setting.SecretKey)
}

func (s SecureData) DecodeAndDecrypt() ([]byte, error) {
	return util.Decrypt(s, setting.SecretKey)
}
