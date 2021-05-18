package securedata

import (
	"github.com/grafana/grafana/pkg/internal/setting"
	"github.com/grafana/grafana/pkg/internal/util"
)

type SecureData []byte

func Encrypt(data []byte) (SecureData, error) {
	return util.Encrypt(data, setting.SecretKey)
}

func (s SecureData) Decrypt() ([]byte, error) {
	return util.Decrypt(s, setting.SecretKey)
}
