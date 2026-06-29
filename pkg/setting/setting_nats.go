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

	Discovery         string
	DiscoveryInterval time.Duration
	DiscoveryTTL      time.Duration

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

// NATSAuthSettings configures the connection identity. Per-role credentials let
// publisher and subscriber present distinct least-privilege identities; an
// empty role value falls back to the shared CredentialsFile.
type NATSAuthSettings struct {
	Token                     string
	CredentialsFile           string
	PublisherCredentialsFile  string
	SubscriberCredentialsFile string
}

func readNATSSettings(cfg *Cfg) error {
	section := cfg.Raw.Section("nats")

	mode := NATSMode(section.Key("mode").MustString(string(NATSModeEmbedded)))
	switch mode {
	case NATSModeEmbedded, NATSModeExternal:
	default:
		return fmt.Errorf("invalid nats mode %q, expected %q or %q", mode, NATSModeEmbedded, NATSModeExternal)
	}

	cfg.NATS = NATSSettings{
		Enabled:           section.Key("enabled").MustBool(false),
		Mode:              mode,
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
	return nil
}

// Embedded reports whether an in-process Core NATS server should run.
func (s NATSSettings) Embedded() bool {
	return s.Mode == NATSModeEmbedded
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
