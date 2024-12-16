package resources

import (
	"crypto/sha256"
	"encoding/base64"
	"path"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type IDMapper func(repo string, path string, obj metav1.Object) (objectName string, folderName string)

// This picks the names from the saved the metadata
func NamesFromMetadata(_ string, _ string, obj metav1.Object) (objectName string, folderName string) {
	objectName = obj.GetName()
	anno := obj.GetAnnotations()
	if anno != nil {
		folderName = anno[utils.AnnoKeyFolder]
	}
	return
}

// This picks names based entirely on the path
func NamesFromFileName(_ string, fpath string, _ metav1.Object) (objectName string, folderName string) {
	objectName = path.Base(fpath)
	idx := strings.LastIndex(fpath, "/")
	if idx > 0 {
		folderName = strings.ReplaceAll(fpath[0:idx], "/", "-")
	}
	return
}

// Will pick a name based on the hashed repository and path
func NamesFromHashedRepoPath(repo string, fpath string, _ metav1.Object) (objectName string, folderName string) {
	// remove the extension
	idx := strings.LastIndex(fpath, ".")
	if idx > 0 {
		fpath = fpath[0:idx]
	}

	hasher := func(fpath string) string {
		name := path.Base(fpath)
		if len(name) > 12 {
			name = name[0:12]
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
