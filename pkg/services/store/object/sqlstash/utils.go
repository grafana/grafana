package sqlstash

import "strings"

// TODO? should this includ the slash or not
func getParentFolderKey(key string) string {
	idx := strings.LastIndex(key, "/")
	return key[:idx]
}
