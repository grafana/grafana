// Package source implements the Provisioning side of the Source API: a small
// provider-neutral HTTP contract that a namespace's desired state is pulled from.
// The contract itself is defined in pkg/source/v1/source.proto.
package source

import "regexp"

// Revisions are opaque and compared for equality only. The shape is the one
// Provisioning already accepts as a ref.
var revisionPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{7,128}$`)
