// go:build integration
package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestEnv(b *testing.B, resourceCount, permissionPerResource int) ([]*Permission, []string) {
	res := make([]*Permission, resourceCount*permissionPerResource)
	ids := make([]string, resourceCount)

	for r := 0; r < resourceCount; r++ {
		for p := 0; p < permissionPerResource; p++ {
			perm := Permission{Action: fmt.Sprintf("resources:action%v", p), Scope: fmt.Sprintf("resources:id:%v", r)}
			id := r*permissionPerResource + p
			res[id] = &perm
		}
		ids[r] = fmt.Sprintf("%d", r)
	}

	return res, ids
}

func benchGetMetadata(b *testing.B, resourceCount, permissionPerResource int) {
	permissions, ids := setupTestEnv(b, resourceCount, permissionPerResource)
	b.ResetTimer()

	var metadata map[string]Metadata
	var err error
	for n := 0; n < b.N; n++ {
		metadata, err = GetResourcesMetadata(context.Background(), permissions, "resources", ids)
		require.NoError(b, err)
		assert.Len(b, metadata, resourceCount)
		for _, resourceMetadata := range metadata {
			assert.Len(b, resourceMetadata, permissionPerResource)
		}
	}
}

// Lots of permissions
func BenchmarkGetResourcesMetadata_10_1000(b *testing.B)   { benchGetMetadata(b, 10, 1000) }   // ~0.008s/op
func BenchmarkGetResourcesMetadata_10_10000(b *testing.B)  { benchGetMetadata(b, 10, 10000) }  // ~0.08s/op
func BenchmarkGetResourcesMetadata_10_100000(b *testing.B) { benchGetMetadata(b, 10, 100000) } // ~0.8s/op
func BenchmarkGetResourcesMetadata_10_1000000(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchGetMetadata(b, 10, 1000000)
} // ~11s/op

// Lots of resources (worst case)
func BenchmarkGetResourcesMetadata_1000_10(b *testing.B)   { benchGetMetadata(b, 1000, 10) }   // ~0,01s/op
func BenchmarkGetResourcesMetadata_10000_10(b *testing.B)  { benchGetMetadata(b, 10000, 10) }  // ~0,3s/op
func BenchmarkGetResourcesMetadata_100000_10(b *testing.B) { benchGetMetadata(b, 100000, 10) } // ~4s/op
func BenchmarkGetResourcesMetadata_1000000_10(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchGetMetadata(b, 1000000, 10)
} // ~51/op

// TODO clean this once people have tested
// To compare with v1
// func benchGetMetadataV1(b *testing.B, resourceCount, permissionPerResource int) {
// 	permissions, ids := setupTestEnv(b, resourceCount, permissionPerResource)
// 	b.ResetTimer()

// 	var metadata map[string]Metadata
// 	var err error
// 	for n := 0; n < b.N; n++ {
// 		metadata, err = GetResourcesMetadataV1(context.Background(), permissions, "resources", ids)
// 		require.NoError(b, err)
// 		assert.Len(b, metadata, resourceCount)
// 		// for _, resourceMetadata := range metadata {
// 		// 	assert.Len(b, resourceMetadata, permissionPerResource)
// 		// }
// 	}
// }

// func BenchmarkGetResourcesMetadataV1_10_100000(b *testing.B) { benchGetMetadataV1(b, 10, 100000) }

// func BenchmarkGetResourcesMetadataV1_100000_10(b *testing.B) { benchGetMetadataV1(b, 100000, 10) } // timeout
