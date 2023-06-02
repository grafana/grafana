package sqlstash

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
)

func createContentsHash(body []byte, meta []byte, status []byte) string {
	h := md5.New()
	_, _ = h.Write(meta)
	_, _ = h.Write(body)
	_, _ = h.Write(status)
	hash := h.Sum(nil)
	return hex.EncodeToString(hash[:])
}

func orgIdToNamespace(orgId int64) string {
	if orgId > 1 {
		return fmt.Sprintf("org-%d", orgId)
	}
	return "default"
}
