package client

import (
	"cmf/grafana-datamanager-datasource/pkg/backendapi/client/factory"
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

type backendClient struct {
	conn *grpc.ClientConn
	proto.DataManagerServicesClient
}

func (b *backendClient) Dispose() {
	if err := b.conn.Close(); err != nil {
		log.DefaultLogger.Error("could not close connection on dispose", "error", err.Error())
	}
}

func New(settings BackendAPIDatasourceSettings) (BackendAPIClient, error) {
	options := []grpc.DialOption{}
	if settings.ApiKeyAuthenticationEnabled {
		log.DefaultLogger.Info("dial with api-key authentication", "endpoint", settings.Endpoint)
		options = append(options, grpc.WithTransportCredentials(credentials.NewTLS(nil)),
			grpc.WithPerRPCCredentials(ApiKeyAuthenticator{
				ApiKey: settings.APIKey,
			}),
			grpc.WithUnaryInterceptor(GRPCDebugLogger()),
		)
	} else {
		log.DefaultLogger.Info("dial without credentials", "endpoint", settings.Endpoint)
		options = append(options, grpc.WithUnaryInterceptor(GRPCDebugLogger()),
			grpc.WithInsecure())
	}

	conn, err := grpc.Dial(settings.Endpoint, options...)
	if err != nil {
		log.DefaultLogger.Error("could not dial")
		return nil, err
	}

	c, err := factory.NewClient(conn)
	if err != nil {
		return nil, err
	}
	return &backendClient{
		conn:                  conn,
		DataManagerServicesClient: c,
	}, nil
}
