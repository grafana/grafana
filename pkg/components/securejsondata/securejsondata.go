package securejsondata

import (
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type SecureJsonData map[string][]byte

func (s SecureJsonData) Decrypt() map[string]string {
	decrypted := make(map[string]string)
	for key, data := range s {
		decrypted[key] = string(util.Decrypt(data, setting.SecretKey))
	}
	return decrypted
}

func GetEncryptedJsonData(sjd map[string]string) SecureJsonData {
	encrypted := make(SecureJsonData)
	for key, data := range sjd {
		encrypted[key] = util.Encrypt([]byte(data), setting.SecretKey)
	}
	return encrypted
}
