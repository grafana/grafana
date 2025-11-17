package encryption

import "github.com/grafana/grafana/pkg/storage/secret/migrator"

type EncryptedValue struct {
	Namespace     string
	Name          string
	Version       int64
	DataKeyID     string
	EncryptedData []byte
	Created       int64
	Updated       int64
}

func (*EncryptedValue) TableName() string {
	return migrator.TableNameEncryptedValue
}
