package apiserver

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"strconv"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/authtoken"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/server"
	liveDto "github.com/grafana/grafana-plugin-sdk-go/live"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/auth"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"
)

var (
	logger = log.New("plugin_grpc_api")
)

func init() {
	registry.RegisterServiceWithPriority(&GRPCAPIServer{}, registry.Low)
}

// GRPCAPIServer ...
type GRPCAPIServer struct {
	Cfg             *setting.Cfg             `inject:""`
	GrafanaLive     *live.GrafanaLive        `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	JWT             *authtoken.JWT           `inject:""`

	server *grpc.Server
}

func (s *GRPCAPIServer) loadTLSCredentials() (credentials.TransportCredentials, error) {
	serverCert, err := tls.LoadX509KeyPair(s.Cfg.PluginGRPCCertFile, s.Cfg.PluginGRPCKeyFile)
	if err != nil {
		return nil, err
	}
	config := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientAuth:   tls.NoClientCert,
	}
	return credentials.NewTLS(config), nil
}

// Init Receiver.
func (s *GRPCAPIServer) Init() error {
	logger.Info("Plugin GRPC API server initialization", "address", s.Cfg.PluginGRPCAddress, "network", s.Cfg.PluginGRPCNetwork, "tls", s.Cfg.PluginGRPCUseTLS)

	if !s.IsEnabled() {
		logger.Debug("GRPCAPIServer not enabled, skipping initialization")
		return nil
	}

	listener, err := net.Listen(s.Cfg.PluginGRPCNetwork, s.Cfg.PluginGRPCAddress)
	if err != nil {
		return fmt.Errorf("failed to listen: %v", err)
	}

	authenticator := &Authenticator{JWT: s.JWT}

	opts := []grpc.ServerOption{
		grpc.StreamInterceptor(grpcAuth.StreamServerInterceptor(authenticator.Authenticate)),
		grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(authenticator.Authenticate)),
	}
	if s.Cfg.PluginGRPCUseTLS {
		cred, err := s.loadTLSCredentials()
		if err != nil {
			return fmt.Errorf("error loading GRPC TLS Credentials: %w", err)
		}
		opts = append(opts, grpc.Creds(cred))
	}

	grpcServer := grpc.NewServer(opts...)
	s.server = grpcServer
	server.RegisterGrafanaServer(grpcServer, s)
	go func() {
		err := grpcServer.Serve(listener)
		if err != nil {
			logger.Error("can't serve GRPC", "error", err)
		}
	}()
	return nil
}

// Run Server.
func (s *GRPCAPIServer) Run(ctx context.Context) error {
	if !s.IsEnabled() {
		logger.Debug("Live feature not enabled, skipping initialization of GRPC server")
		return nil
	}
	<-ctx.Done()
	s.server.Stop()
	return ctx.Err()
}

// IsEnabled returns true if feature flag is on.
func (s *GRPCAPIServer) IsEnabled() bool {
	return s.Cfg.IsPluginAPIServerEnabled()
}

func (s *GRPCAPIServer) GetOrgToken(ctx context.Context, req *server.GetOrgTokenRequest) (*server.GetOrgTokenResponse, error) {
	identity, ok := GetIdentity(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "no authentication found")
	}
	if identity.Type != authtoken.IdentityTypePlugin {
		return nil, status.Error(codes.Unauthenticated, "unsupported identity type")
	}
	pluginIdentity := identity.PluginIdentity
	if pluginIdentity.OrgID != 0 {
		return nil, status.Error(codes.PermissionDenied, "organization ID already in identity")
	}
	pluginID := pluginIdentity.PluginID

	query := &models.GetDataSourcesByTypeQuery{
		Type: pluginID,
	}
	err := bus.Dispatch(query)
	if err != nil {
		return nil, err
	}

	for _, ds := range query.Result {
		if ds.OrgId == req.OrgId {
			token, err := s.JWT.IssuePluginToken(pluginID, req.OrgId)
			if err != nil {
				return nil, err
			}
			return &server.GetOrgTokenResponse{
				Token: token,
			}, nil
		}
	}

	return nil, status.Error(codes.NotFound, `datasource not found in organization`)
}

func (s *GRPCAPIServer) PublishStream(ctx context.Context, request *server.PublishStreamRequest) (*server.PublishStreamResponse, error) {
	identity, ok := GetIdentity(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "no authentication found")
	}
	if identity.Type != authtoken.IdentityTypePlugin {
		return nil, status.Error(codes.Unauthenticated, "unsupported identity type")
	}
	pluginIdentity := identity.PluginIdentity
	if pluginIdentity.OrgID <= 0 {
		return nil, status.Error(codes.PermissionDenied, "no organization ID context in identity")
	}
	logger.Debug("plugin publishes data to a channel", "pluginId", pluginIdentity.PluginID, "orgId", pluginIdentity.OrgID, "channel", request.Channel)

	channel := liveDto.ParseChannel(request.Channel)
	if !channel.IsValid() {
		return nil, status.Error(codes.InvalidArgument, `invalid channel`)
	}

	switch channel.Scope {
	case liveDto.ScopePlugin:
		if channel.Namespace != pluginIdentity.PluginID {
			return nil, status.Error(codes.PermissionDenied, `can not publish to another plugin namespace`)
		}
	case liveDto.ScopeDatasource:
		var ds *models.DataSource
		numericID, err := strconv.ParseInt(channel.Namespace, 10, 64)
		// TODO: Need to refactor DatasourceCache? We use fake SignedInUser here,
		// but DatasourceCache internally only uses OrgID field.
		user := &models.SignedInUser{OrgId: pluginIdentity.OrgID}
		if err != nil {
			ds, err = s.DatasourceCache.GetDatasourceByUID(channel.Namespace, user, false)
		} else {
			ds, err = s.DatasourceCache.GetDatasource(numericID, user, false)
		}
		if err != nil {
			if errors.Is(err, models.ErrDataSourceNotFound) {
				return nil, status.Error(codes.NotFound, `datasource not found`)
			}
			logger.Error("Error getting datasource", "error", err)
			return nil, status.Error(codes.Internal, `internal server error`)
		}
		if ds.Type != pluginIdentity.PluginID {
			return nil, status.Error(codes.PermissionDenied, `can not publish to another plugin namespace`)
		}
	default:
		return nil, status.Error(codes.PermissionDenied, `can not publish to scope`)
	}

	// Permission checks passed, let message be published.

	err := s.GrafanaLive.Publish(request.Channel, request.Data)
	if err != nil {
		logger.Error("Error publishing into channel", "error", err, "channel", request.Channel, "data", string(request.Data))
		return nil, status.Error(codes.Internal, `internal error`)
	}

	return &server.PublishStreamResponse{}, nil
}
