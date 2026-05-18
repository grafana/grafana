// SPDX-License-Identifier: AGPL-3.0-only

// Hand-written deepcopy for DescendantCountsOptions to avoid mixing into the
// codegen-managed zz_generated.deepcopy.go. The type is too small and too
// stable to be worth a codegen round-trip.

package v1

import (
	runtime "k8s.io/apimachinery/pkg/runtime"
)

// DeepCopyInto copies the receiver into out. in must be non-nil.
func (in *DescendantCountsOptions) DeepCopyInto(out *DescendantCountsOptions) {
	*out = *in
	out.TypeMeta = in.TypeMeta
}

// DeepCopy creates a new DescendantCountsOptions.
func (in *DescendantCountsOptions) DeepCopy() *DescendantCountsOptions {
	if in == nil {
		return nil
	}
	out := new(DescendantCountsOptions)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject implements runtime.Object.
func (in *DescendantCountsOptions) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// SwaggerDoc supplies field-level descriptions to the apiserver's
// AddObjectParams reflection: that's what surfaces a human-readable note
// next to the `recursive` query parameter on the generated swagger spec.
func (DescendantCountsOptions) SwaggerDoc() map[string]string {
	return map[string]string{
		"recursive": "When true (or bare `?recursive`), walk the folder subtree under a server-side 10s timeout and return aggregated counts; on timeout the server returns 504. When absent or false, the response only reflects resources directly inside the folder.",
	}
}
