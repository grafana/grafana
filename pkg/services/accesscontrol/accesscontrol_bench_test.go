// go:build integration
package accesscontrol

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func setupTestEnv(b *testing.B, resourceCount, permissionPerResource int) ([]*Permission, map[string]bool) {
	res := make([]*Permission, resourceCount*permissionPerResource)
	ids := make(map[string]bool, resourceCount)

	for r := 0; r < resourceCount; r++ {
		for p := 0; p < permissionPerResource; p++ {
			perm := Permission{Action: fmt.Sprintf("resources:action%v", p), Scope: fmt.Sprintf("resources:id:%v", r)}
			id := r*permissionPerResource + p
			res[id] = &perm
		}
		ids[fmt.Sprintf("%d", r)] = true
	}

	return res, ids
}

func benchGetMetadata(b *testing.B, resourceCount, permissionPerResource int) {
	permissions, ids := setupTestEnv(b, resourceCount, permissionPerResource)
	b.ResetTimer()

	var metadata map[string]Metadata
	for n := 0; n < b.N; n++ {
		metadata = GetResourcesMetadata(context.Background(), permissions, "resources", ids)
		assert.Len(b, metadata, resourceCount)
		for _, resourceMetadata := range metadata {
			assert.Len(b, resourceMetadata, permissionPerResource)
		}
	}
}

// Lots of permissions
func BenchmarkGetResourcesMetadata_10_1000(b *testing.B)   { benchGetMetadata(b, 10, 1000) }   // ~0.0017s/op
func BenchmarkGetResourcesMetadata_10_10000(b *testing.B)  { benchGetMetadata(b, 10, 10000) }  // ~0.016s/op
func BenchmarkGetResourcesMetadata_10_100000(b *testing.B) { benchGetMetadata(b, 10, 100000) } // ~0.17s/op
func BenchmarkGetResourcesMetadata_10_1000000(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchGetMetadata(b, 10, 1000000)
} // ~3.89s/op

// Lots of resources
func BenchmarkGetResourcesMetadata_1000_10(b *testing.B)   { benchGetMetadata(b, 1000, 10) }   // ~0,0023s/op
func BenchmarkGetResourcesMetadata_10000_10(b *testing.B)  { benchGetMetadata(b, 10000, 10) }  // ~0.021s/op
func BenchmarkGetResourcesMetadata_100000_10(b *testing.B) { benchGetMetadata(b, 100000, 10) } // ~0.22s/op
func BenchmarkGetResourcesMetadata_1000000_10(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchGetMetadata(b, 1000000, 10)
} // ~2.8s/op
