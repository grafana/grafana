package utils

import (
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/types"
)

func AsK8sUID(orgId int64, uid string, kind string) types.UID {
	hasher := sha1.New()
	hasher.Write([]byte(fmt.Sprintf("%d|%s|%s", orgId, uid, kind)))
	v := base64.URLEncoding.EncodeToString(hasher.Sum(nil))
	return types.UID(strings.ReplaceAll(v, "=", ""))
}
