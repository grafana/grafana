package resource

import (
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type UnifiedStorageGrpcService interface {
	services.NamedService
	grpcserver.HealthProbe
}

type RingClient struct {
	Client resourceclient.SearchClient
	grpc_health_v1.HealthClient
	Conn *grpc.ClientConn
}

func (c *RingClient) Close() error {
	return c.Conn.Close()
}

func (c *RingClient) String() string {
	return c.RemoteAddress()
}

func (c *RingClient) RemoteAddress() string {
	return c.Conn.Target()
}

const RingKey = "search-server-ring"

const RingName = "search_server_ring"

const RingHeartbeatTimeout = time.Minute

const RingNumTokens = 128
