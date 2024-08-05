package cache

import (
	"net"
	"time"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	"github.com/prometheus/client_golang/prometheus"
)

type ringConfig struct {
	Addr string
	Port string
}

func newRing(cfg ringConfig, logger log.Logger, client kv.Client) (*ring.Ring, *ring.BasicLifecycler, error) {
	var ringConfig ring.Config
	ringConfig.ReplicationFactor = 1
	hring, err := ring.NewWithStoreClientAndStrategy(
		ringConfig,
		"local",           // ring name
		"collectors/ring", // prefix key where peers are stored
		client,
		ring.NewDefaultReplicationStrategy(),
		prometheus.NewPedanticRegistry(),
		log.With(logger, "component", "ring"),
	)

	if err != nil {
		return nil, nil, err
	}

	var config ring.BasicLifecyclerConfig
	config.ID = cfg.Addr
	config.Addr = net.JoinHostPort(cfg.Addr, cfg.Port)

	var delegate ring.BasicLifecyclerDelegate
	delegate = ring.NewInstanceRegisterDelegate(ring.ACTIVE, 128)
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(1*time.Minute, delegate, logger)

	lfc, err := ring.NewBasicLifecycler(
		config,
		"local",
		"collectors/ring",
		client,
		delegate,
		log.With(logger, "component", "lifecycler"),
		prometheus.NewPedanticRegistry(),
	)

	if err != nil {
		return nil, nil, err
	}

	return hring, lfc, nil
}
