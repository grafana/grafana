package sqlstash

import (
	"crypto/md5"
	"encoding/hex"
)

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}
