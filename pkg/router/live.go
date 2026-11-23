// The Live ingress accepts only the plugin v2 Stream service. The browser
// connection and channel fan-out remain in the originating Grafana process.
package router

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/dskit/services"
	v2 "github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/setting"
)

type liveIngress struct {
	v2.UnimplementedStreamServer
	router *GrafanaRouter
	groups map[string]string // configured plugin ID to its installed manifest group
}

type liveBackend interface {
	PluginLiveClient() (string, v2.StreamClient)
}

// RegisterLiveStreams registers an internal service on a mutually authenticated
// listener. The dedicated client CA issues one DNS identity, stack-<id>, per
// single-tenant Grafana. Each Grafana is authoritative for users in its stack.
func (r *GrafanaRouter) RegisterLiveStreams(s grpc.ServiceRegistrar, groups map[string]string) {
	v2.RegisterStreamServer(s, &liveIngress{router: r, groups: groups})
}

func (l *liveIngress) target(ctx context.Context, pc *v2.PluginContext) (context.Context, v2.StreamClient, func(), error) {
	p, ok := peer.FromContext(ctx)
	if !ok {
		return nil, nil, nil, status.Error(codes.Unauthenticated, "missing peer")
	}
	ti, ok := p.AuthInfo.(credentials.TLSInfo)
	if !ok || len(ti.State.VerifiedChains) == 0 {
		return nil, nil, nil, status.Error(codes.Unauthenticated, "verified client certificate required")
	}
	cert := ti.State.VerifiedChains[0][0]
	if len(cert.DNSNames) != 1 {
		return nil, nil, nil, status.Error(codes.PermissionDenied, "expected a single stack identity")
	}
	stack, ok := strings.CutPrefix(cert.DNSNames[0], "stack-")
	id, err := strconv.ParseUint(stack, 10, 63)
	if !ok || err != nil || id == 0 || strconv.FormatUint(id, 10) != stack {
		return nil, nil, nil, status.Error(codes.PermissionDenied, "invalid stack identity")
	}
	ns := "stacks-" + stack
	ids := metadata.ValueFromIncomingContext(ctx, "stackid")
	if len(ids) > 1 || (len(ids) == 1 && ids[0] != stack) || pc.GetOrgId() != 1 || (pc.GetNamespace() != "default" && pc.GetNamespace() != ns) || pc.GetDataSourceInstanceSettings() != nil {
		return nil, nil, nil, status.Error(codes.PermissionDenied, "context outside the certified Grafana stack")
	}
	group := l.groups[pc.GetPluginId()]
	if group == "" || !l.router.visible(ctx, view{namespace: ns}, group) {
		return nil, nil, nil, status.Error(codes.NotFound, "Live plugin unavailable")
	}
	entry, ok := (*l.router.snapshot.Load())[group]
	if !ok {
		return nil, nil, nil, status.Error(codes.NotFound, "Live plugin unavailable")
	}
	backend, ok := entry.handler.(liveBackend)
	if !ok {
		return nil, nil, nil, status.Error(codes.Unimplemented, "group does not serve plugin streams")
	}
	plugin, client := backend.PluginLiveClient()
	if plugin != pc.GetPluginId() || client == nil {
		return nil, nil, nil, status.Error(codes.Unimplemented, "group does not serve plugin streams")
	}
	if !entry.use.enter() {
		return nil, nil, nil, status.Error(codes.Unavailable, "Live route changed")
	}
	// Forward only the transport-verified tenant. Long streams must reauthorize
	// when the certificate expires or their route is retired.
	ctx, cancel := context.WithDeadline(metadata.NewOutgoingContext(ctx, metadata.Pairs("stackid", stack)), cert.NotAfter)
	stop := context.AfterFunc(entry.watches, cancel)
	return ctx, client, func() { stop(); cancel(); entry.use.exit() }, nil
}

func (l *liveIngress) SubscribeStream(ctx context.Context, r *v2.SubscribeStreamRequest) (*v2.SubscribeStreamResponse, error) {
	ctx, client, done, err := l.target(ctx, r.GetPluginContext())
	if err != nil {
		return nil, err
	}
	defer done()
	return client.SubscribeStream(ctx, r, grpc_retry.Disable())
}

func (l *liveIngress) PublishStream(ctx context.Context, r *v2.PublishStreamRequest) (*v2.PublishStreamResponse, error) {
	ctx, client, done, err := l.target(ctx, r.GetPluginContext())
	if err != nil {
		return nil, err
	}
	defer done()
	return client.PublishStream(ctx, r, grpc_retry.Disable())
}

func (l *liveIngress) RunStream(r *v2.RunStreamRequest, out grpc.ServerStreamingServer[v2.StreamPacket]) error {
	ctx, client, done, err := l.target(out.Context(), r.GetPluginContext())
	if err != nil {
		return err
	}
	defer done()
	upstream, err := client.RunStream(ctx, r)
	if err != nil {
		return err
	}
	for {
		packet, err := upstream.Recv()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		if err = out.Send(packet); err != nil {
			return err
		}
	}
}

// LiveService returns nil unless the dedicated router listener is configured.
func (r *GrafanaRouter) LiveService(cfg *setting.Cfg) (services.Service, error) {
	section := cfg.SectionWithEnvOverrides("router.live")
	address := section.Key("listen_address").String()
	if address == "" {
		return nil, nil
	}
	if cfg.GRPCServer.TLSConfig == nil || cfg.GRPCServer.TLSConfig.ClientCAs == nil {
		return nil, fmt.Errorf("router.live requires a server certificate and a dedicated stack client CA in grpc_server")
	}
	groups := map[string]string{}
	for _, pair := range strings.Fields(section.Key("plugin_groups").String()) {
		id, g, ok := strings.Cut(pair, "=")
		if !ok || !isAppPluginID(id) || !isPluginManifestGroup(g) || groups[id] != "" {
			return nil, fmt.Errorf("invalid router.live plugin_groups entry %q", pair)
		}
		groups[id] = g
	}
	if len(groups) == 0 {
		return nil, fmt.Errorf("router.live requires plugin_groups")
	}
	age, err := liveConnectionAge(section)
	if err != nil {
		return nil, err
	}
	tc := cfg.GRPCServer.TLSConfig.Clone()
	tc.ClientAuth = tls.RequireAndVerifyClientCert
	srv := grpc.NewServer(grpc.Creds(credentials.NewTLS(tc)), grpc.KeepaliveParams(age))
	r.RegisterLiveStreams(srv, groups)
	var listener net.Listener
	return services.NewBasicService(func(ctx context.Context) error {
		var err error
		listener, err = (&net.ListenConfig{}).Listen(ctx, "tcp", address)
		return err
	}, func(ctx context.Context) error {
		end := context.AfterFunc(ctx, srv.Stop)
		defer end()
		return srv.Serve(listener)
	}, func(error) error { srv.Stop(); return nil }).WithName("router-live"), nil
}

// The router closes each Live connection gracefully after a maximum age, as the
// operator does. Once the router sends GOAWAY, Grafana starts new calls,
// including publishes, on a fresh connection. Streams still open when the grace
// period ends are closed, and Grafana reopens them. Keep the age well below the
// stack certificate lifetime, so connections rarely reach the hard expiry
// deadline.
const (
	defaultLiveMaxConnectionAge      = 5 * time.Minute
	defaultLiveMaxConnectionAgeGrace = 30 * time.Second
)

func liveConnectionAge(section *setting.DynamicSection) (keepalive.ServerParameters, error) {
	age, err := parsePositiveDurationKey(section, "max_connection_age", defaultLiveMaxConnectionAge)
	if err != nil {
		return keepalive.ServerParameters{}, fmt.Errorf("router.live: %w", err)
	}
	grace, err := parsePositiveDurationKey(section, "max_connection_age_grace", defaultLiveMaxConnectionAgeGrace)
	if err != nil {
		return keepalive.ServerParameters{}, fmt.Errorf("router.live: %w", err)
	}
	return keepalive.ServerParameters{MaxConnectionAge: age, MaxConnectionAgeGrace: grace}, nil
}
