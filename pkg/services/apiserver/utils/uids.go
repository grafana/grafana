package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"unicode"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
)

// Create a stable UID that will be unique across a multi-tenant cluster
// This is useful while we migrate from SQL storage to something where the UID (GUID)
// is actually baked into the storage engine itself.
func CalculateClusterWideUID(obj runtime.Object) types.UID {
	gvk := obj.GetObjectKind().GroupVersionKind()
	hasher := sha256.New()
	hasher.Write([]byte(gvk.Group))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(gvk.Kind))
	hasher.Write([]byte("|"))
	meta, err := meta.Accessor(obj)
	if err == nil {
		hasher.Write([]byte(meta.GetNamespace()))
		hasher.Write([]byte("|"))
		hasher.Write([]byte(meta.GetName()))
	}
	v := base64.URLEncoding.EncodeToString(hasher.Sum(nil))
	return types.UID(strings.Map(func(r rune) rune {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return 'X'
		}
		return r
	}, v))
}
