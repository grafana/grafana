package sqlstash

import (
	"crypto/md5"
	"encoding/hex"
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

func getParentFolderPath(kind string, key string) string {
	idx := strings.LastIndex(key, "/")
	if idx < 0 {
		return "" // ?
	}

	// folder should have a parent up one directory
	if kind == models.StandardKindFolder {
		idx = strings.LastIndex(key[:idx], "/")
	}
	return key[:idx]
}
