package secret

type encryptedValueDB struct {
	UID           string `xorm:"pk 'uid'"`
	EncryptedData []byte `xorm:"encrypted_data"`
	Created       int64  `xorm:"created"`
	Updated       int64  `xorm:"updated"`
}

func (*encryptedValueDB) TableName() string {
	return TableNameEncryptedValue
}
