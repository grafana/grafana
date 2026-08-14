package team

import (
	"context"
	"sort"
	"strings"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// MutateOnCreateAndUpdate canonicalizes spec.externalGroups before storage so
// the stored form is consistent across dual-writer modes: each entry is
// trimmed and lowercased, then the slice is sorted. Duplicates and empty
// entries are intentionally left in place; ValidateOnCreate/Update rejects
// them so the client sees a 400 instead of silent coalescing.
func MutateOnCreateAndUpdate(ctx context.Context, obj *iamv0alpha1.Team) error {
	if len(obj.Spec.ExternalGroups) == 0 {
		return nil
	}
	for i, g := range obj.Spec.ExternalGroups {
		obj.Spec.ExternalGroups[i] = strings.ToLower(strings.TrimSpace(g))
	}
	sort.Strings(obj.Spec.ExternalGroups)
	return nil
}
