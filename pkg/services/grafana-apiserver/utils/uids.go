package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"
	"unicode"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Create a stable UID that will be unique across a multi-tenant cluster
func CalculateClusterWideUID(obj metav1.Object, kind string) types.UID {
	hasher := sha256.New()
	hasher.Write([]byte(kind))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(obj.GetNamespace()))
	hasher.Write([]byte("|"))
	hasher.Write([]byte(obj.GetName()))
	v := base64.URLEncoding.EncodeToString(hasher.Sum(nil))
	return types.UID(strings.Map(func(r rune) rune {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r)) {
			return 'X'
		}
		return r
	}, v))
}
