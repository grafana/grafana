package migration

import (
	"os"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
)

// SecureJsonData is used to store encrypted data (for example in data_source table). Only values are separately
// encrypted.
type SecureJsonData map[string][]byte

var seclogger = log.New("securejsondata")

// Decrypt returns map of the same type but where the all the values are decrypted. Opposite of what
// GetEncryptedJsonData is doing.
func (s SecureJsonData) Decrypt(secretKey string) map[string]string {
	decrypted := make(map[string]string)
	for key, data := range s {
		decryptedData, err := util.Decrypt(data, secretKey)
		if err != nil {
			seclogger.Error(err.Error())
			os.Exit(1)
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted
}
