package sqlstash

import "strings"

// TODO? should this include the slash or not?
func getParentFolderKey(key string) string {
	idx := strings.LastIndex(key, "/")
	return key[:idx]
}
