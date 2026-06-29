package setting

import (
	"fmt"

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
		Enabled:          section.Key("enabled").MustBool(false),
		Mode:             mode,
		ClientURLs:       util.SplitString(section.Key("client_urls").MustString("")),
		ListenAddress:    section.Key("listen_address").MustString("127.0.0.1"),
		ClientPort:       section.Key("client_port").MustInt(4222),
		ClusterPort:      section.Key("cluster_port").MustInt(6222),
		AdvertiseAddress: section.Key("advertise_address").MustString(""),
	}
	return nil
}

// Embedded reports whether an in-process Core NATS server should run.
func (s NATSSettings) Embedded() bool {
	return s.Mode == NATSModeEmbedded
}
