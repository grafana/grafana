package router

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	v2 "github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

func TestLiveRequiresCertifiedStackAndMatchingPlugin(t *testing.T) {
	const id = "example-test-app"
	group := "test.ext.grafana.app"
	r := NewGrafanaRouter(nil, nil)
	gate := liveIngress{router: r, groups: map[string]string{id: group}}
	routeCtx, retire := context.WithCancel(t.Context())
	defer retire()
	handler := &tracedPluginHandler{pluginID: id, live: v2.NewStreamClient(nil)}
	entries := map[string]servingEntry{group: {handler: handler, use: newHandlerUse(handler), watches: routeCtx}}
	r.snapshot.Store(&entries)
	pc := &v2.PluginContext{PluginId: id, OrgId: 1, Namespace: "default"}
	_, _, _, err := gate.target(t.Context(), pc)
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	cert := &x509.Certificate{DNSNames: []string{"stack-101"}, NotAfter: time.Now().Add(time.Minute)}
	ctx := peer.NewContext(t.Context(), &peer.Peer{AuthInfo: credentials.TLSInfo{State: tls.ConnectionState{VerifiedChains: [][]*x509.Certificate{{cert}}}}})
	wrong := metadata.NewIncomingContext(ctx, metadata.Pairs("stackid", "202"))
	_, _, _, err = gate.target(wrong, pc)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	pc.Namespace = "stacks-202"
	_, _, _, err = gate.target(ctx, pc)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	pc.Namespace = "stacks-101"
	denied := func() { _, _, _, e := gate.target(ctx, pc); require.Equal(t, codes.NotFound, status.Code(e)) }
	require.NoError(t, r.SetGroupVisibility([]string{group}, nil))
	denied()
	require.NoError(t, r.SetGroupVisibility(nil, nil))
	out, client, done, err := gate.target(ctx, pc)
	require.NoError(t, err)
	defer done()
	require.Equal(t, handler.live, client)
	md, _ := metadata.FromOutgoingContext(out)
	require.Equal(t, []string{"101"}, md.Get("stackid"))
	retire()
	select {
	case <-out.Done():
	case <-time.After(time.Second):
		t.Fatal("retiring a route must cancel its stream")
	}
}
func TestManagedLiveRequiresVerifiedBackendTLS(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(pluginManifestsFixture)) }))
	defer srv.Close()
	for _, tc := range []struct {
		name   string
		config *tls.Config
		want   bool
	}{
		{"plaintext", nil, false}, {"server only", &tls.Config{}, false}, {"unverified", &tls.Config{InsecureSkipVerify: true, Certificates: []tls.Certificate{{}}}, false}, {"mutual", &tls.Config{Certificates: []tls.Certificate{{}}}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := defaultPluginGRPCConfig()
			cfg.TLS = tc.config
			target, err := newPluginManifestsTarget(sourcePlugins, srv.URL, nil, srv.Client(), cfg, PluginDependencies{})
			require.NoError(t, err)
			defer target.closeConnections()
			target.poll(t.Context(), make(chan struct{}, 1))
			require.Len(t, target.Backends(), 1)
			require.Equal(t, tc.want, target.Backends()[0].(*PluginBackend).routedLive)
		})
	}
}
