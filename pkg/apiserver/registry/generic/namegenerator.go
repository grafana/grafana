package generic

import (
	"k8s.io/apiserver/pkg/storage/names"

	"github.com/grafana/grafana/pkg/util"
)

// ShortUIDNameGenerator appends util.GenerateShortUID() to the base; used for metadata.generateName.
var ShortUIDNameGenerator names.NameGenerator = shortUIDNameGenerator{}

type shortUIDNameGenerator struct{}

func (shortUIDNameGenerator) GenerateName(base string) string {
	return base + util.GenerateShortUID()
}
