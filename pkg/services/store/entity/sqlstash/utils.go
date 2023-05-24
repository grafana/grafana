package sqlstash

import (
	"crypto/md5"
	"encoding/hex"
)

func createContentsHash(body []byte, meta []byte, status []byte) string {
	h := md5.New()
	if meta != nil {
		_, _ = h.Write(meta)
	}
	if body != nil {
		_, _ = h.Write(body)
	}
	if status != nil {
		_, _ = h.Write(status)
	}
	hash := h.Sum(nil)
	return hex.EncodeToString(hash[:])
}
