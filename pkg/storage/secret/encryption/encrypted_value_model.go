package encryption

import "github.com/grafana/grafana/pkg/storage/secret/migrator"

type EncryptedValue struct {
	UID           string `xorm:"pk 'uid'"`
	EncryptedData []byte `xorm:"encrypted_data"`
	Created       int64  `xorm:"created"`
	Updated       int64  `xorm:"updated"`
}

func (*EncryptedValue) TableName() string {
	return migrator.TableNameEncryptedValue
}
