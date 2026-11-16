package legacyclient

import (
	"fmt"
	"testing"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// Use real gRPC serialization over an in-memory connection, without network latency.
func BenchmarkLegacyUserPermissionsWire(b *testing.B) {
	for _, count := range []int{1000, 10000, 50000} {
		b.Run(fmt.Sprintf("permissions=%d", count), func(b *testing.B) {
			var chunks []*authzv1.LegacyGetUserPermissionsResponse
			for start := 0; start < count; start += 1000 {
				chunk := &authzv1.LegacyGetUserPermissionsResponse{}
				for i := start; i < min(start+1000, count); i++ {
					chunk.Permissions = append(chunk.Permissions, &authzv1.LegacyUserPermission{Action: "dashboards:read", Scope: fmt.Sprintf("dashboards:uid:fixture-%d", i)})
				}
				chunks = append(chunks, chunk)
			}
			server := &legacyTransportServer{handle: func(_ *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
				for _, chunk := range chunks {
					if err := stream.Send(chunk); err != nil {
						return err
					}
				}
				return nil
			}}
			client := newLegacyTransportClient(b, server)
			caller := legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get")
			request := legacyRequest()
			// Establish the connection before measuring repeated calls.
			if _, err := client.LegacyGetUserPermissions(b.Context(), caller, request); err != nil {
				b.Fatal(err)
			}
			b.ReportAllocs()
			for b.Loop() {
				response, err := client.LegacyGetUserPermissions(b.Context(), caller, request)
				if err != nil {
					b.Fatal(err)
				}
				if len(response.Permissions) != count {
					b.Fatalf("got %d permissions, want %d", len(response.Permissions), count)
				}
			}
		})
	}
}
