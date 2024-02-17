package sqlstash

import (
	"crypto/md5"
	"encoding/hex"
)

func createContentsHash(body []byte, meta []byte, status []byte) string {
	h := md5.New()
	_, _ = h.Write(meta)
	_, _ = h.Write(body)
	_, _ = h.Write(status)
	hash := h.Sum(nil)
	return hex.EncodeToString(hash[:])
}
