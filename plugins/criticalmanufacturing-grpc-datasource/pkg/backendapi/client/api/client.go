package v2

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"google.golang.org/grpc"
)

func NewClient(conn *grpc.ClientConn) (proto.DataManagerServicesClient, error) {
	return proto.NewDataManagerServicesClient(conn), nil
}
