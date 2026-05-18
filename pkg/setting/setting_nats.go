package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/util"
)

type NATSSettings struct {
	Enabled bool

	Embedded bool

	ClientURLs []string

	ListenAddress    string
	ClientPort       int
	ClusterPort      int
	AdvertiseAddress string

	Discovery         string
	DiscoveryInterval time.Duration
	DiscoveryTTL      time.Duration
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
	}
}
