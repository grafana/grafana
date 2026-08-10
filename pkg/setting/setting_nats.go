package setting

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

// NATSMode selects the bus topology. The modes are mutually exclusive; a future
// "bridge" mode slots in as another value.
type NATSMode string

const (
	NATSModeEmbedded NATSMode = "embedded"
	NATSModeExternal NATSMode = "external"
)

// NATSAuthMode names the connection auth mechanism explicitly, so the active
// method is declared in configuration rather than inferred from which of several
// credential fields happens to be populated.
type NATSAuthMode string

const (
	// NATSAuthModeNone connects without credentials.
	NATSAuthModeNone NATSAuthMode = "none"
	// NATSAuthModeToken presents the static token.
	NATSAuthModeToken NATSAuthMode = "token"
	// NATSAuthModeCredentials presents a NATS .creds file (per-role, falling back
	// to the shared file).
	NATSAuthModeCredentials NATSAuthMode = "credentials"
	// NATSAuthModeTokenExchange mints a short-lived authlib access token per
	// (re)connect and presents it as the connect token.
	NATSAuthModeTokenExchange NATSAuthMode = "token_exchange"
)

// NATSSettings configures the stateless Core NATS message bus that signals
// unified-storage resource changes; a disabled or unavailable bus degrades
// gracefully to DB polling. Keys are documented in defaults.ini.
type NATSSettings struct {
	Enabled bool
	Mode    NATSMode

	// ClientURLs are the servers clients connect to; in embedded mode the local
	// server is prepended automatically.
	ClientURLs []string

	ListenAddress    string
	ClientPort       int
	ClusterPort      int
	AdvertiseAddress string

	// DiscoveryEnabled turns on KV-backed peer discovery so embedded replicas
	// self-assemble into a mesh; disabling it runs a single standalone node.
	DiscoveryEnabled bool

	// DiscoveryInterval is how often an embedded node refreshes its registry
	// heartbeat and reconciles cluster routes. DiscoveryTTL is how long a peer is
	// trusted after its last heartbeat before its route is dropped and row pruned;
	// keep it a comfortable multiple of DiscoveryInterval.
	DiscoveryInterval time.Duration
	DiscoveryTTL      time.Duration

	// NotifierShadow runs a NATS-backed notifier beside the primary notifier for
	// testing: comparison metrics only, never feeds the watch pipeline.
	NotifierShadow bool

	// Notifier feeds the watch pipeline directly from the NATS bus instead of
	// polling. Delivery is at-most-once; a disabled or unavailable bus degrades
	// to polling.
	Notifier bool

	TLS  NATSTLSSettings
	Auth NATSAuthSettings
}

type NATSTLSSettings struct {
	Enabled    bool
	CACertPath string
	CertPath   string
	KeyPath    string
	ServerName string
	// InsecureSkipVerify is for testing only; never enable in production.
	InsecureSkipVerify bool
}

// NATSAuthSettings configures the connection identity. Mode selects the auth
// mechanism explicitly; the fields it consumes depend on that choice:
//
//   - "credentials": a NATS .creds file. A per-role file lets each role present a
//     least-privilege identity; an empty value falls back to the shared
//     CredentialsFile.
//   - "token_exchange": mint a short-lived authlib access token per (re)connect
//     and present it as the connect token, so an external auth-callout service can
//     verify it and grant least-privilege permissions from its claims. The
//     exchange endpoint and bootstrap token are shared with the
//     [grpc_client_authentication] section rather than duplicated.
//   - "token": the static Token.
//   - "none": connect without credentials.
//
// The mode drives selection rather than a precedence over populated fields, so
// the active mechanism is self-evident from configuration.
type NATSAuthSettings struct {
	Mode NATSAuthMode

	Token                     string
	CredentialsFile           string
	PublisherCredentialsFile  string
	SubscriberCredentialsFile string

	// TokenExchangeAudiences are the audiences requested for the minted access
	// token; a non-empty value turns token-exchange auth on. TokenExchangeURL,
	// TokenExchangeToken and TokenExchangeNamespace are read from
	// [grpc_client_authentication] so a service that already talks to the cloud
	// signer reuses the same wiring. The publisher and subscriber connections
	// request the same audience: the auth-callout service authorizes on the
	// verified token, not on a per-role audience.
	TokenExchangeAudiences []string
	TokenExchangeURL       string
	TokenExchangeToken     string
	TokenExchangeNamespace string
}

func readNATSSettings(cfg *Cfg) error {
	section := cfg.Raw.Section("nats")
	// Token exchange reuses the cloud client wiring (signer URL + bootstrap token)
	// that grafana-app services already configure, so the NATS client does not need
	// its own secret plumbing. Env overrides (GF_GRPC_CLIENT_AUTHENTICATION_*) apply.
	grpcClient := cfg.SectionWithEnvOverrides("grpc_client_authentication")

	mode := NATSMode(section.Key("mode").MustString(string(NATSModeEmbedded)))
	switch mode {
	case NATSModeEmbedded, NATSModeExternal:
	default:
		return fmt.Errorf("invalid nats mode %q, expected %q or %q", mode, NATSModeEmbedded, NATSModeExternal)
	}

	cfg.NATS = NATSSettings{
		Enabled:          section.Key("enabled").MustBool(false),
		Mode:             mode,
		ClientURLs:       util.SplitString(section.Key("client_urls").MustString("")),
		ListenAddress:    section.Key("listen_address").MustString("127.0.0.1"),
		ClientPort:       section.Key("client_port").MustInt(4222),
		ClusterPort:      section.Key("cluster_port").MustInt(6222),
		AdvertiseAddress: section.Key("advertise_address").MustString(""),

		DiscoveryEnabled:  section.Key("discovery_enabled").MustBool(true),
		DiscoveryInterval: section.Key("discovery_interval").MustDuration(5 * time.Second),
		DiscoveryTTL:      section.Key("discovery_ttl").MustDuration(30 * time.Second),
		NotifierShadow:    section.Key("notifier_shadow").MustBool(false),
		Notifier:          section.Key("notifier").MustBool(false),
		TLS: NATSTLSSettings{
			Enabled:            section.Key("tls_enabled").MustBool(false),
			CACertPath:         section.Key("tls_ca_cert_path").MustString(""),
			CertPath:           section.Key("tls_cert_path").MustString(""),
			KeyPath:            section.Key("tls_key_path").MustString(""),
			ServerName:         section.Key("tls_server_name").MustString(""),
			InsecureSkipVerify: section.Key("tls_insecure_skip_verify").MustBool(false),
		},
		Auth: NATSAuthSettings{
			Mode:                      NATSAuthMode(section.Key("auth_mode").MustString(string(NATSAuthModeNone))),
			Token:                     section.Key("token").MustString(""),
			CredentialsFile:           section.Key("credentials_file").MustString(""),
			PublisherCredentialsFile:  section.Key("publisher_credentials_file").MustString(""),
			SubscriberCredentialsFile: section.Key("subscriber_credentials_file").MustString(""),
			TokenExchangeAudiences:    util.SplitString(section.Key("token_exchange_audiences").MustString("")),
			TokenExchangeURL:          grpcClient.Key("token_exchange_url").MustString(""),
			TokenExchangeToken:        grpcClient.Key("token").MustString(""),
			TokenExchangeNamespace:    grpcClient.Key("token_namespace").MustString("stacks-" + cfg.StackID),
		},
	}
	if err := cfg.NATS.Auth.validate(cfg.NATS.Enabled); err != nil {
		return err
	}
	return nil
}

// validate rejects an unknown auth_mode always, and (when the bus is enabled)
// the mode being missing the fields it needs, so a misconfiguration fails at
// startup rather than silently connecting unauthenticated.
func (a NATSAuthSettings) validate(enabled bool) error {
	switch a.Mode {
	case NATSAuthModeNone, NATSAuthModeToken, NATSAuthModeCredentials, NATSAuthModeTokenExchange:
	default:
		return fmt.Errorf("invalid nats auth_mode %q, expected one of %q, %q, %q, %q",
			a.Mode, NATSAuthModeNone, NATSAuthModeToken, NATSAuthModeCredentials, NATSAuthModeTokenExchange)
	}
	if !enabled {
		return nil
	}
	switch a.Mode {
	case NATSAuthModeNone:
	case NATSAuthModeToken:
		if a.Token == "" {
			return fmt.Errorf("nats auth_mode %q requires token", NATSAuthModeToken)
		}
	case NATSAuthModeCredentials:
		if a.PublisherCredentials() == "" || a.SubscriberCredentials() == "" {
			return fmt.Errorf("nats auth_mode %q requires credentials_file (or both publisher_credentials_file and subscriber_credentials_file)", NATSAuthModeCredentials)
		}
	case NATSAuthModeTokenExchange:
		if !a.TokenExchangeEnabled() {
			return fmt.Errorf("nats auth_mode %q requires token_exchange_audiences plus token_exchange_url and token in [grpc_client_authentication]", NATSAuthModeTokenExchange)
		}
	}
	return nil
}

// Embedded reports whether an in-process Core NATS server should run.
func (s NATSSettings) Embedded() bool {
	return s.Mode == NATSModeEmbedded
}

// TokenExchangeEnabled reports whether the connection should mint short-lived
// access tokens via authlib token exchange. It needs a target audience plus the
// exchange endpoint and bootstrap token (shared with [grpc_client_authentication]).
func (a NATSAuthSettings) TokenExchangeEnabled() bool {
	return len(a.TokenExchangeAudiences) > 0 && a.TokenExchangeURL != "" && a.TokenExchangeToken != ""
}

func (a NATSAuthSettings) PublisherCredentials() string {
	if a.PublisherCredentialsFile != "" {
		return a.PublisherCredentialsFile
	}
	return a.CredentialsFile
}

func (a NATSAuthSettings) SubscriberCredentials() string {
	if a.SubscriberCredentialsFile != "" {
		return a.SubscriberCredentialsFile
	}
	return a.CredentialsFile
}
