package factory

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"
	"context"

	v2client "cmf/grafana-datamanager-datasource/pkg/backendapi/client/api"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/jhump/protoreflect/grpcreflect"
	"google.golang.org/grpc"
	rpb "google.golang.org/grpc/reflection/grpc_reflection_v1alpha"
)

func NewClient(conn *grpc.ClientConn) (proto.DataManagerServicesClient, error) {
	stub := rpb.NewServerReflectionClient(conn)

	c := grpcreflect.NewClient(context.Background(), stub)
	_, err := c.ResolveService("Cmf.DataManager.DataManagerServices")
	if err != nil {
		backend.Logger.Error("Error occurred while trying to resolve v2 API")
	}
	backend.Logger.Info("use default version of the backend API")
	return v2client.NewClient(conn)
}
