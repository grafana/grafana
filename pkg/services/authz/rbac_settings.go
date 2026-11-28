package authz

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

type clientMode string

func (s clientMode) IsValid() bool {
	switch s {
	case clientModeInproc, clientModeCloud:
		return true
	}
	return false
}

const (
	clientModeCloud  clientMode = "cloud"
	clientModeInproc clientMode = "inproc"
)

type authzClientSettings struct {
	remoteAddress        string
	certFile             string
	mode                 clientMode
	loadBalancingEnabled bool

	token            string
	tokenExchangeURL string
	tokenNamespace   string

	cacheTTL time.Duration

	grpcClientKeepaliveTime    time.Duration
	grpcClientKeepaliveTimeout time.Duration
	grpcClientTimeout          time.Duration
}

func readAuthzClientSettings(cfg *setting.Cfg) (*authzClientSettings, error) {
	authzSection := cfg.SectionWithEnvOverrides("authorization")
	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	mode := clientMode(authzSection.Key("mode").MustString(string(clientModeInproc)))
	if !mode.IsValid() {
		return nil, fmt.Errorf("authorization: invalid mode %q", mode)
	}

	s := &authzClientSettings{}
	// Cache duration applies to the server cache in proc, so it's relevant for both modes.
	s.cacheTTL = authzSection.Key("cache_ttl").MustDuration(30 * time.Second)

	s.mode = mode
	if s.mode == clientModeInproc {
		return s, nil
	}
	s.loadBalancingEnabled = authzSection.Key("load_balancing_enabled").MustBool(false)

	s.remoteAddress = authzSection.Key("remote_address").MustString("")
	s.certFile = authzSection.Key("cert_file").MustString("")

	// Keepalive is disabled by default: pinging more often than the server's keepalive
	// enforcement MinTime allows makes the server close the connection with
	// GOAWAY(too_many_pings). See [grpc_server] keepalive_min_time.
	s.grpcClientKeepaliveTime = authzSection.Key("grpc_client_keepalive_time").MustDuration(0)
	s.grpcClientKeepaliveTimeout = authzSection.Key("grpc_client_keepalive_timeout").MustDuration(10 * time.Second)
	s.grpcClientTimeout = authzSection.Key("grpc_client_timeout").MustDuration(0)

	s.token = grpcClientAuthSection.Key("token").MustString("")
	s.tokenNamespace = grpcClientAuthSection.Key("token_namespace").MustString("stacks-" + cfg.StackID)
	s.tokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")

	// When running in cloud mode, the token and tokenExchangeURL are required.
	if s.token == "" || s.tokenExchangeURL == "" {
		return nil, fmt.Errorf("authorization:  missing token or tokenExchangeUrl")
	}

	return s, nil
}

type RBACServerSettings struct {
	Folder                         FolderAPISettings
	CacheTTL                       time.Duration
	LocalFolderCacheTTL            time.Duration
	ForcePermissionRoleActionIndex bool
}

func readEmbeddedRBACServerSettings(cfg *setting.Cfg) RBACServerSettings {
	return RBACServerSettings{
		ForcePermissionRoleActionIndex: cfg.SectionWithEnvOverrides("authorization").Key("force_permission_role_action_index").MustBool(false),
	}
}

type FolderAPISettings struct {
	// Host is hostname for folder api
	Host string
	// Insecure will skip verification of certificates. Should only be used for testing
	Insecure bool
	// CAFile is a filepath to trusted root certificates for server
	CAFile string
}
