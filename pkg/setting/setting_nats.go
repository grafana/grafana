package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/util"
)

// NATSSettings configures the Core NATS message bus used to signal
// unified-storage resource changes to controllers. The bus is stateless:
// it only carries change signals, never durable event state, so a disabled
// or unavailable bus degrades gracefully to DB polling.
type NATSSettings struct {
	// Enabled turns the NATS infrastructure on. Disabled by default.
	Enabled bool

	// Embedded starts an in-process Core NATS server. When false, clients
	// connect to the URLs in ClientURLs (external mode).
	Embedded bool

	// ClientURLs are the Core NATS servers clients connect to. In embedded
	// mode the local server is prepended automatically.
	ClientURLs []string

	// Embedded server listener settings.
	ListenAddress    string
	ClientPort       int
	ClusterPort      int
	AdvertiseAddress string

	// Peer discovery for embedded clusters.
	Discovery         string
	DiscoveryInterval time.Duration
	DiscoveryTTL      time.Duration

	// TLS configures transport security for client connections.
	TLS NATSTLSSettings

	// Auth configures the connection identity presented to the server.
	Auth NATSAuthSettings
}

// NATSTLSSettings configures TLS for client connections.
type NATSTLSSettings struct {
	Enabled bool
	// CACertPath is the CA bundle used to verify the server certificate.
	CACertPath string
	// CertPath / KeyPath enable mutual TLS (client certificate auth).
	CertPath string
	KeyPath  string
	// ServerName overrides the hostname verified against the server cert.
	ServerName string
	// InsecureSkipVerify disables server certificate verification. For
	// testing only; never enable in production.
	InsecureSkipVerify bool
}

// NATSAuthSettings configures the credentials presented when connecting.
// Per-role credentials let the publisher and subscriber present distinct,
// least-privilege identities (pub-only vs sub-only) in external mode; when a
// role-specific value is empty the shared value is used.
type NATSAuthSettings struct {
	// Token is a shared bearer token (lowest-privilege, simplest form).
	Token string
	// CredentialsFile is a shared NATS .creds file (JWT + NKEY seed).
	CredentialsFile string
	// Per-role credential overrides.
	PublisherCredentialsFile  string
	SubscriberCredentialsFile string
}

func readNATSSettings(cfg *Cfg) {
	section := cfg.Raw.Section("nats")

	cfg.NATS = NATSSettings{
		Enabled:           section.Key("enabled").MustBool(false),
		Embedded:          section.Key("embedded").MustBool(true),
		ClientURLs:        util.SplitString(section.Key("client_urls").MustString("")),
		ListenAddress:     section.Key("listen_address").MustString("127.0.0.1"),
		ClientPort:        section.Key("client_port").MustInt(4222),
		ClusterPort:       section.Key("cluster_port").MustInt(6222),
		AdvertiseAddress:  section.Key("advertise_address").MustString(""),
		Discovery:         section.Key("discovery").MustString("auto"),
		DiscoveryInterval: section.Key("discovery_interval").MustDuration(30 * time.Second),
		DiscoveryTTL:      section.Key("discovery_ttl").MustDuration(5 * time.Minute),
		TLS: NATSTLSSettings{
			Enabled:            section.Key("tls_enabled").MustBool(false),
			CACertPath:         section.Key("tls_ca_cert_path").MustString(""),
			CertPath:           section.Key("tls_cert_path").MustString(""),
			KeyPath:            section.Key("tls_key_path").MustString(""),
			ServerName:         section.Key("tls_server_name").MustString(""),
			InsecureSkipVerify: section.Key("tls_insecure_skip_verify").MustBool(false),
		},
		Auth: NATSAuthSettings{
			Token:                     section.Key("token").MustString(""),
			CredentialsFile:           section.Key("credentials_file").MustString(""),
			PublisherCredentialsFile:  section.Key("publisher_credentials_file").MustString(""),
			SubscriberCredentialsFile: section.Key("subscriber_credentials_file").MustString(""),
		},
	}
}

// PublisherCredentials returns the credentials file the publisher role should
// present, falling back to the shared credentials file.
func (a NATSAuthSettings) PublisherCredentials() string {
	if a.PublisherCredentialsFile != "" {
		return a.PublisherCredentialsFile
	}
	return a.CredentialsFile
}

// SubscriberCredentials returns the credentials file the subscriber role should
// present, falling back to the shared credentials file.
func (a NATSAuthSettings) SubscriberCredentials() string {
	if a.SubscriberCredentialsFile != "" {
		return a.SubscriberCredentialsFile
	}
	return a.CredentialsFile
}
