package dashboard

import (
	"crypto/sha256"
	"fmt"
	"unicode"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"k8s.io/apimachinery/pkg/util/validation"
)

// This makes an consistent mapping between Grafana UIDs and k8s compatible names
func GrafanaUIDToK8sName(uid string) string {
	if allLowercaseAlphaNum(uid) && validation.IsQualifiedName(uid) == nil {
		return uid // OK, so just use it directly
	}

	//  ¯\_(ツ)_/¯  really should do an alias or somethign
	h := sha256.New()
	_, _ = h.Write([]byte(uid))
	bs := h.Sum(nil)
	return fmt.Sprintf("g%x", bs[:12])
}

func allLowercaseAlphaNum(s string) bool {
	for _, r := range s {
		if !(unicode.IsLower(r) || unicode.IsDigit(r)) {
			return false
		}
	}
	return true
}

func stripNulls(j *simplejson.Json) {
	m, err := j.Map()
	if err != nil {
		arr, err := j.Array()
		if err == nil {
			for i := range arr {
				stripNulls(j.GetIndex(i))
			}
		}
		return
	}
	for k, v := range m {
		if v == nil {
			j.Del(k)
		} else {
			stripNulls(j.Get(k))
		}
	}
}
