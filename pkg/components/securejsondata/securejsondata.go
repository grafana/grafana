package securejsondata

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// SecureJsonData is used to store encrypted data (for example in data_source table). Only values are separately
// encrypted.
type SecureJsonData map[string][]byte

// DecryptedValue returns single decrypted value from SecureJsonData. Similar to normal map access second return value
// is true if the key exists and false if not.
func (s SecureJsonData) DecryptedValue(key string) (string, bool) {
	if value, ok := s[key]; ok {
		decryptedData, err := util.Decrypt(value, setting.SecretKey)
		if err != nil {
			log.Fatal(4, err.Error())
		}
		return string(decryptedData), true
	}
	return "", false
}

// Decrypt returns map of the same type but where the all the values are decrypted. Opposite of what
// GetEncryptedJsonData is doing.
func (s SecureJsonData) Decrypt() map[string]string {
	decrypted := make(map[string]string)
	for key, data := range s {
		decryptedData, err := util.Decrypt(data, setting.SecretKey)
		if err != nil {
			log.Fatal(4, err.Error())
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted
}

// GetEncryptedJsonData returns map where all keys are encrypted.
func GetEncryptedJsonData(sjd map[string]string) SecureJsonData {
	encrypted := make(SecureJsonData)
	for key, data := range sjd {
		encryptedData, err := util.Encrypt([]byte(data), setting.SecretKey)
		if err != nil {
			log.Fatal(4, err.Error())
		}

		encrypted[key] = encryptedData
	}
	return encrypted
}
