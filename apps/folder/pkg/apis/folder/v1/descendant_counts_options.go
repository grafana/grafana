// SPDX-License-Identifier: AGPL-3.0-only

package v1

// SwaggerDoc supplies field-level descriptions to the apiserver's
// AddObjectParams reflection: that's what surfaces a human-readable note
// next to the `recursive` query parameter on the generated swagger spec.
func (DescendantCountsOptions) SwaggerDoc() map[string]string {
	return map[string]string{
		"recursive": "When true (or bare `?recursive`), walk the folder subtree under a server-side 10s timeout and return aggregated counts; on timeout the server returns 504. When absent or false, the response only reflects resources directly inside the folder.",
	}
}
