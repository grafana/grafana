package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
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
		for _, outcome := range []string{"normal shutdown", "publisher failure", "subscriber failure"} {
			if mode == "publisher module" && outcome == "subscriber failure" {
				continue
			}
			t.Run(mode+"/"+outcome, func(t *testing.T) {
				broker := newNATSLifecycleBroker(t)
				cfg := setting.NewCfg()
				cfg.NATS = setting.NATSSettings{
					Enabled: true, Mode: setting.NATSModeExternal,
					ClientURLs: []string{broker.url},
					Notifier:   mode == "notifier module", NotifierShadow: mode == "shadow module",
				}
				reg := prometheus.NewRegistry()
				peer := &natsLifecyclePeer{services.NewIdleService(nil, nil).WithName("peer")}
				var owner services.Service
				var publisher *nats.PublisherService
				var subscriber *nats.SubscriberService
				if mode == "background services" {
					natsCfg := nats.ProvideNATSConfig(cfg, nil)
					publisher = nats.ProvidePublisher(natsCfg, reg)
					subscriber = nats.ProvideSubscriber(natsCfg, reg)
					owner = adapter.NewManagerAdapter(natsLifecycleRegistry{publisher, subscriber, peer}).
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
				connections := broker.connections.Load()
				if subscriber == nil {
					require.EqualValues(t, 1, connections)
				} else {
					require.EqualValues(t, 2, connections)
				}

				switch outcome {
				case "normal shutdown":
					cancel()
				case "publisher failure":
					broker.fail(t, "grafana-nats-publisher")
				case "subscriber failure":
					broker.fail(t, "grafana-nats-subscriber")
				}
				stoppedCtx, stopCancel := context.WithTimeout(t.Context(), 5*time.Second)
				defer stopCancel()
				err := owner.AwaitTerminated(stoppedCtx)
				if outcome == "normal shutdown" {
					require.NoError(t, err)
					require.Equal(t, services.Terminated, owner.State())
					require.Nil(t, owner.FailureCase())
				} else {
					require.Error(t, err)
					require.Equal(t, services.Failed, owner.State())
					require.ErrorContains(t, owner.FailureCase(), "test terminal error")
					if outcome == "publisher failure" {
						require.Equal(t, services.Failed, publisher.State())
						require.ErrorIs(t, owner.FailureCase(), publisher.FailureCase())
					} else {
						require.Equal(t, services.Failed, subscriber.State())
						require.ErrorIs(t, owner.FailureCase(), subscriber.FailureCase())
					}
				}
				require.Equal(t, services.Terminated, peer.State())
				require.Equal(t, connections, broker.connections.Load(), "shutdown must not create replacement connections")
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
}

type natsLifecycleRegistry []registry.BackgroundService

func (r natsLifecycleRegistry) GetServices() []registry.BackgroundService { return r }

type natsLifecyclePeer struct{ services.NamedService }

func (p *natsLifecyclePeer) Run(ctx context.Context) error {
	if err := p.StartAsync(ctx); err != nil {
		return err
	}
	return p.AwaitTerminated(context.Background())
}

// A controlled broker lets tests send a terminal protocol error to one role;
// closing a real broker's socket would only exercise automatic reconnection.
type natsLifecycleBroker struct {
	url         string
	mu          sync.Mutex
	clients     map[string]net.Conn
	connections atomic.Int64
}

func newNATSLifecycleBroker(t *testing.T) *natsLifecycleBroker {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	broker := &natsLifecycleBroker{
		url:     "nats://" + listener.Addr().String(),
		clients: make(map[string]net.Conn),
	}
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			broker.connections.Add(1)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer conn.Close()
				// Bound even a failed handshake so cleanup cannot leave a reader behind.
				_ = conn.SetDeadline(time.Now().Add(15 * time.Second))
				_, _ = fmt.Fprint(conn, "INFO {}\r\n")
				scanner := bufio.NewScanner(conn)
				for scanner.Scan() {
					line := scanner.Text()
					if strings.HasPrefix(line, "CONNECT ") {
						var info struct{ Name string }
						if json.Unmarshal([]byte(strings.TrimPrefix(line, "CONNECT ")), &info) != nil {
							return
						}
						broker.mu.Lock()
						broker.clients[info.Name] = conn
						broker.mu.Unlock()
					}
					if line == "PING" {
						_, _ = fmt.Fprint(conn, "PONG\r\n")
					}
				}
			}()
		}
	}()
	t.Cleanup(func() {
		_ = listener.Close()
		broker.mu.Lock()
		for _, conn := range broker.clients {
			_ = conn.Close()
		}
		broker.mu.Unlock()
		wg.Wait()
	})
	return broker
}

func (b *natsLifecycleBroker) fail(t *testing.T, name string) {
	t.Helper()
	b.mu.Lock()
	conn := b.clients[name]
	b.mu.Unlock()
	require.NotNil(t, conn)
	_, err := fmt.Fprint(conn, "-ERR 'test terminal error'\r\n")
	require.NoError(t, err)
}
