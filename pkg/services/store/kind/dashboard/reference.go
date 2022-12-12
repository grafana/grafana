package dashboard

import (
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/models"
)

// A reference accumulator can combine
type ReferenceAccumulator interface {
	// Add references as we find them
	Add(kind string, subtype string, uid string)

	// Returns the set of distinct references in a sorted order
	Get() []*models.EntityExternalReference
}

func NewReferenceAccumulator() ReferenceAccumulator {
	return &referenceAccumulator{
		refs: make(map[string]*models.EntityExternalReference),
	}
}

type referenceAccumulator struct {
	refs map[string]*models.EntityExternalReference
}

func (x *referenceAccumulator) Add(kind string, sub string, uid string) {
	key := fmt.Sprintf("%s/%s/%s", kind, sub, uid)
	_, ok := x.refs[key]
	if !ok {
		x.refs[key] = &models.EntityExternalReference{
			Kind: kind,
			Type: sub,
			UID:  uid,
		}
	}
}

func (x *referenceAccumulator) Get() []*models.EntityExternalReference {
	keys := make([]string, 0, len(x.refs))
	for k := range x.refs {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	refs := make([]*models.EntityExternalReference, len(keys))
	for i, key := range keys {
		refs[i] = x.refs[key]
	}
	return refs
}
