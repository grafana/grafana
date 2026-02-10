package datasource

import (
	"crypto/sha256"
	"encoding/hex"
	"iter"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// ToInlineSecureValues converts secure json into InlineSecureValues with reference names
// The names are predictable and can be used while we implement dual writing for secrets
func ToInlineSecureValues(dsUID string, keys iter.Seq[string]) common.InlineSecureValues {
	values := make(common.InlineSecureValues)
	for k := range keys {
		values[k] = common.InlineSecureValue{
			Name: GetLegacySecureValueName(dsUID, k),
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

func GetLegacySecureValueName(dsUID string, key string) string {
	h := sha256.New()
	h.Write([]byte(dsUID)) // unique identifier
	h.Write([]byte("|"))
	h.Write([]byte(key)) // property name
	n := hex.EncodeToString(h.Sum(nil))
	return apistore.LEGACY_DATASOURCE_SECURE_VALUE_NAME_PREFIX + n[0:10] // predictable name for dual writing
}
