package dashboard

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

// A reference accumulator can combine
type ReferenceAccumulator interface {
	// Add references as we find them
	Add(family string, ttype string, id string)

	// Returns the set of distinct references in a sorted order
	Get() []*entity.EntityExternalReference
}

func NewReferenceAccumulator() ReferenceAccumulator {
	return &referenceAccumulator{
		refs: make(map[string]*entity.EntityExternalReference),
	}
}

type referenceAccumulator struct {
	refs map[string]*entity.EntityExternalReference
}

func (x *referenceAccumulator) Add(family string, ttype string, id string) {
	key := fmt.Sprintf("%s/%s/%s", family, ttype, id)
	_, ok := x.refs[key]
	if !ok {
		x.refs[key] = &entity.EntityExternalReference{
			Family:     family,
			Type:       ttype,
			Identifier: id,
		}
	}
}

func (x *referenceAccumulator) Get() []*entity.EntityExternalReference {
	keys := make([]string, 0, len(x.refs))
	for k := range x.refs {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	refs := make([]*entity.EntityExternalReference, len(keys))
	for i, key := range keys {
		refs[i] = x.refs[key]
	}
	return refs
}
