package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	natsserver "github.com/nats-io/nats-server/v2/server"
	natstest "github.com/nats-io/nats-server/v2/test"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/backgroundsvcs/adapter"
	"github.com/grafana/grafana/pkg/setting"
)

func TestNATSManagedLifecycle(t *testing.T) {
	for _, mode := range []string{"background services", "publisher module", "notifier module", "shadow module"} {
		t.Run(mode, func(t *testing.T) {
			broker := natstest.RunServer(&natsserver.Options{Host: "127.0.0.1", Port: -1})
			t.Cleanup(func() {
				broker.Shutdown()
				broker.WaitForShutdown()
			})
			cfg := setting.NewCfg()
			cfg.NATS = setting.NATSSettings{
				Enabled: true, Mode: setting.NATSModeExternal,
				ClientURLs: []string{broker.ClientURL()},
				Notifier:   mode == "notifier module", NotifierShadow: mode == "shadow module",
			}
			reg := prometheus.NewRegistry()
			peer := services.NewIdleService(nil, nil).WithName("peer")
			var owner services.Service
			var publisher *nats.PublisherService
			var subscriber *nats.SubscriberService
			if mode == "background services" {
				natsCfg := nats.ProvideNATSConfig(cfg, nil)
				publisher = nats.ProvidePublisher(natsCfg, reg)
				subscriber = nats.ProvideSubscriber(natsCfg, reg)
				owner = adapter.NewManagerAdapter(natsLifecycleRegistry{publisher, subscriber}).
					WithDependencies(map[string][]string{adapter.BackgroundServices: {adapter.Core}, adapter.Core: {}})
			} else {
				ms := &ModuleServer{cfg: cfg, registerer: reg}
				natsModule, err := ms.initNATSModule()
				require.NoError(t, err)
				publisher = ms.natsPublisher.(*nats.PublisherService)
				if ms.natsSubscriber != nil {
					subscriber = ms.natsSubscriber.(*nats.SubscriberService)
				}
				manager := modules.New(log.NewNopLogger(), []string{modules.NATS, "peer"}).
					WithDependencies(map[string][]string{})
				manager.RegisterModule(modules.NATS, func() (services.Service, error) { return natsModule, nil })
				manager.RegisterModule("peer", func() (services.Service, error) { return peer, nil })
				owner = manager
			}
			ctx, cancel := context.WithCancel(t.Context())
			t.Cleanup(cancel)
			t.Cleanup(func() {
				cancel()
				stoppedCtx, stopCancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer stopCancel()
				_ = services.StopAndAwaitTerminated(stoppedCtx, owner)
			})
			require.NoError(t, services.StartAndAwaitRunning(ctx, owner))
			require.NoError(t, publisher.Health(ctx))
			if subscriber != nil {
				require.NoError(t, subscriber.Health(ctx))
			}
			connections := broker.NumClients()
			if subscriber == nil {
				require.EqualValues(t, 1, connections)
			} else {
				require.EqualValues(t, 2, connections)
			}

			cancel()
			stoppedCtx, stopCancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer stopCancel()
			err := owner.AwaitTerminated(stoppedCtx)
			require.NoError(t, err)
			require.Equal(t, services.Terminated, owner.State())
			require.Nil(t, owner.FailureCase())
			if mode != "background services" {
				require.Equal(t, services.Terminated, peer.State())
			}
			require.Eventually(t, func() bool { return broker.NumClients() == 0 }, 5*time.Second, 10*time.Millisecond)
			require.Error(t, publisher.Health(t.Context()))
			require.ErrorIs(t, publisher.Publish(t.Context(), "test", nil), nats.ErrClosed)
			if subscriber != nil {
				require.Error(t, subscriber.Health(t.Context()))
				_, err := subscriber.Subscribe(t.Context(), "test", func(string, []byte) {})
				require.ErrorIs(t, err, nats.ErrClosed)
			}
		})
	}
}

func TestManagedServiceFailure(t *testing.T) {
	for _, mode := range []string{"module", "composite module"} {
		t.Run(mode, func(t *testing.T) {
			failure := errors.New("test service failure")
			fail := make(chan struct{})
			failing := services.NewBasicService(nil, func(ctx context.Context) error {
				select {
				case <-ctx.Done():
					return nil
				case <-fail:
					return failure
				}
			}, nil).WithName("failing")
			peer := services.NewIdleService(nil, nil).WithName("peer")
			sibling := services.NewIdleService(nil, nil).WithName("sibling")
			var module services.Service = failing
			if mode == "composite module" {
				composite, err := newCompositeService(failing, sibling)
				require.NoError(t, err)
				module = composite.WithName(modules.NATS)
			}
			owner := modules.New(log.NewNopLogger(), []string{modules.NATS, "peer"}).
				WithDependencies(map[string][]string{})
			owner.RegisterModule(modules.NATS, func() (services.Service, error) { return module, nil })
			owner.RegisterModule("peer", func() (services.Service, error) { return peer, nil })
			t.Cleanup(func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = services.StopAndAwaitTerminated(ctx, owner)
			})
			require.NoError(t, services.StartAndAwaitRunning(t.Context(), owner))
			close(fail)
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			require.Error(t, owner.AwaitTerminated(ctx))
			require.Equal(t, services.Failed, owner.State())
			require.ErrorIs(t, owner.FailureCase(), failure)
			require.Equal(t, services.Failed, failing.State())
			require.Equal(t, services.Terminated, peer.State())
			if mode == "composite module" {
				require.Equal(t, services.Terminated, sibling.State())
			}
		})
	}
}

type natsLifecycleRegistry []registry.BackgroundService

func (r natsLifecycleRegistry) GetServices() []registry.BackgroundService { return r }
