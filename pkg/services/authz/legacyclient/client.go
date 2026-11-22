package legacyclient

import (
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// LegacyClient implements only legacy Access Control compatibility operations.
// It is independent of authlib's Check/List client and has no client-side permission cache.
type LegacyClient struct {
	clientV1 authzv1.LegacyAuthzServiceClient
	tracer   trace.Tracer
}

type LegacyClientOption func(*LegacyClient)

func WithLegacyTracerClientOption(tracer trace.Tracer) LegacyClientOption {
	return func(c *LegacyClient) { c.tracer = tracer }
}

// LegacyCheck uses the RBAC connection. LegacyGetUserPermissions requires the
// dedicated embedded service; the RBAC server does not implement enumeration.
func NewLegacyClient(cc grpc.ClientConnInterface, opts ...LegacyClientOption) *LegacyClient {
	client := &LegacyClient{clientV1: authzv1.NewLegacyAuthzServiceClient(cc), tracer: noop.Tracer{}}
	for _, opt := range opts {
		opt(client)
	}
	return client
}
