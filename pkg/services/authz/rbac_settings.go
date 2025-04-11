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
	remoteAddress string
	certFile      string
	mode          clientMode

	token            string
	tokenExchangeURL string
	tokenNamespace   string

	cacheTTL time.Duration
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

	s.remoteAddress = authzSection.Key("remote_address").MustString("")
	s.certFile = authzSection.Key("cert_file").MustString("")

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
	Folder   FolderAPISettings
	CacheTTL time.Duration
}

type FolderAPISettings struct {
	// Host is hostname for folder api
	Host string
	// Insecure will skip verification of ceritificates. Should only be used for testing
	Insecure bool
	// CAFile is a filepath to trusted root certificates for server
	CAFile string
}
