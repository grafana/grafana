package legacy

import (
	"github.com/grafana/grafana/pkg/services/authz/legacy/client"
	"google.golang.org/grpc"
)

func NewClient(cc grpc.ClientConnInterface) *client.Client {
	return client.NewClient(cc)
}
