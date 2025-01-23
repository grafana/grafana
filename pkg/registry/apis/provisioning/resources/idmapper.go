package resources

import (
	"crypto/sha256"
	"encoding/base64"
	"path"
	"strings"
)

// Will pick a name based on the hashed repository and path
func NamesFromHashedRepoPath(repo string, fpath string) (objectName string, folderName string) {
	// remove the extension
	idx := strings.LastIndex(fpath, ".")
	if idx > 0 {
		fpath = fpath[0:idx]
	}

	hasher := func(fpath string) string {
		name := path.Base(fpath)
		if len(name) > 16 {
			name = name[0:16]
		}
		hash := sha256.New()
		_, _ = hash.Write([]byte(repo))
		_, _ = hash.Write([]byte{'/'})
		_, _ = hash.Write([]byte(fpath))
		return name + "-" + base64.URLEncoding.EncodeToString(hash.Sum(nil))[0:12]
	}

	objectName = hasher(fpath)

	idx = strings.LastIndex(fpath, "/")
	if idx > 0 {
		folderName = hasher(fpath[0:idx])
	}
	return
}
