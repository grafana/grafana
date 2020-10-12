package securedata

import (
	"encoding/base64"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type SecureData string

func EncryptAndEncode(data []byte) (SecureData, error) {
	encrypted, err := util.Encrypt(data, setting.SecretKey)
	if err != nil {
		return "", err
	}
	return SecureData(base64.StdEncoding.EncodeToString(encrypted)), nil
}

func (s SecureData) DecodeAndDecrypt() ([]byte, error) {
	decoded, err := base64.StdEncoding.DecodeString(string(s))
	if err != nil {
		return nil, err
	}
	return util.Decrypt(decoded, setting.SecretKey)
}
