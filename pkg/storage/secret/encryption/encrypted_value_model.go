package encryption

import "github.com/grafana/grafana/pkg/storage/secret/migrator"

type EncryptedValue struct {
	UID           string
	Namespace     string
	EncryptedData []byte
	Created       int64
	Updated       int64
}

func (*EncryptedValue) TableName() string {
	return migrator.TableNameEncryptedValue
}
