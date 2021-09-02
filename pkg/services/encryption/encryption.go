package encryption

import (
	"github.com/grafana/grafana/pkg/components/securejsondata"
)

type Service interface {
	Encrypt([]byte, string) ([]byte, error)
	Decrypt([]byte, string) ([]byte, error)

	EncryptToJsonData(map[string]string, string) (securejsondata.SecureJsonData, error)
	DecryptToJsonData(securejsondata.SecureJsonData, string) (map[string]string, error)
}
