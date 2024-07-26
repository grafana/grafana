package legacy_storage

import (
	"encoding/base64"
)

func NameToUid(name string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(name))
}

func UidToName(uid string) (string, error) {
	data, err := base64.RawURLEncoding.DecodeString(uid)
	if err != nil {
		return uid, err
	}
	return string(data), nil
}
