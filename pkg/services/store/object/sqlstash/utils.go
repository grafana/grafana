package sqlstash

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
)

// TODO? should this include the slash or not?
func getParentFolderKey(kind string, key string) string {
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
