package ring

import (
	"fmt"
	"time"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/ring"
	"github.com/prometheus/client_golang/prometheus"
)

type memberlistConfig struct {
	Addr        string
	Port        int
	JoinMembers []string
}

func newMemberlistService(cfg memberlistConfig, logger log.Logger, reg prometheus.Registerer) (*memberlist.KVInitService, *memberlist.Client, error) {
	config := memberlist.KVConfig{
		NodeName: cfg.Addr,
		Codecs:   []codec.Codec{ring.GetCodec()},
		TCPTransport: memberlist.TCPTransportConfig{
			BindPort:  cfg.Port,
			BindAddrs: []string{cfg.Addr},
		},
		JoinMembers:   cfg.JoinMembers,
		StreamTimeout: 5 * time.Second,
	}

	svc := memberlist.NewKVInitService(
		&config,
		log.With(logger, "component", "memberlist"),
		dns.NewProvider(log.With(logger, "component", "dns"), prometheus.NewPedanticRegistry(), dns.GolangResolverType),
		reg,
	)

	store, err := svc.GetMemberlistKV()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create kv: %w", err)
	}

	client, err := memberlist.NewClient(store, ring.GetCodec())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create kv client: %w", err)
	}

	return svc, client, nil
}
