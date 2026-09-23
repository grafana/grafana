package router

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestRemoteResourceClientTokenExchange(t *testing.T) {
	flag := featuremgmt.FlagUnifiedStorageClientRequireCallerIdentity
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flag: {Key: flag, DefaultVariant: "enabled", Variants: map[string]any{"enabled": true}},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	for _, separateSearch := range []bool{false, true} {
		name := "shared storage and search"
		if separateSearch {
			name = "separate search server"
		}
		t.Run(name, func(t *testing.T) {
			var exchanges atomic.Int32
			exchange := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				exchanges.Add(1)
				assert.Equal(t, "Bearer service-token", r.Header.Get("Authorization"))
				var req authnlib.TokenExchangeRequest
				if !assert.NoError(t, json.NewDecoder(r.Body).Decode(&req)) {
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				assert.Equal(t, "caller-token", req.SubjectToken)
				assert.Equal(t, "stacks-11", req.Namespace)
				assert.Equal(t, []string{"resourceStore"}, req.Audiences)
				_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"token": "obo-token"}})
			}))
			t.Cleanup(exchange.Close)

			startServer := func() (string, chan string) {
				listener, err := net.Listen("tcp", "127.0.0.1:0")
				require.NoError(t, err)
				calls := make(chan string, 2)
				server := grpc.NewServer(grpc.UnknownServiceHandler(func(_ any, stream grpc.ServerStream) error {
					md, _ := metadata.FromIncomingContext(stream.Context())
					assert.Equal(t, []string{"obo-token"}, md.Get("x-access-token"))
					method, _ := grpc.MethodFromServerStream(stream)
					select {
					case calls <- method:
					case <-stream.Context().Done():
						return stream.Context().Err()
					}
					switch method {
					case "/resource.ResourceStore/Read":
						if err := stream.RecvMsg(&resourcepb.ReadRequest{}); err != nil {
							return err
						}
						return stream.SendMsg(&resourcepb.ReadResponse{})
					case "/resource.ResourceIndex/Search":
						if err := stream.RecvMsg(&resourcepb.ResourceSearchRequest{}); err != nil {
							return err
						}
						return stream.SendMsg(&resourcepb.ResourceSearchResponse{})
					default:
						t.Errorf("unexpected RPC: %s", method)
						return nil
					}
				}))
				go func() { _ = server.Serve(listener) }()
				t.Cleanup(server.Stop)
				return listener.Addr().String(), calls
			}
			address, storageCalls := startServer()
			searchCalls := storageCalls
			cfg := setting.NewCfg()
			cfg.Env = setting.Dev // The exchange test server uses a self-signed certificate.
			cfg.Raw.Section("grafana-apiserver").Key("address").SetValue(address)
			if separateSearch {
				searchAddress, calls := startServer()
				searchCalls = calls
				cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue(searchAddress)
			}
			auth := cfg.Raw.Section("grpc_client_authentication")
			auth.Key("token").SetValue("service-token")
			auth.Key("token_exchange_url").SetValue(exchange.URL)
			auth.Key("token_namespace").SetValue("*")
			client, err := NewRemoteResourceClient(cfg, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: types.TypeUser, AccessToken: "caller-token", Namespace: "stacks-11"})
			_, err = client.Read(ctx, &resourcepb.ReadRequest{})
			require.NoError(t, err)
			select {
			case method := <-storageCalls:
				assert.Equal(t, "/resource.ResourceStore/Read", method)
			case <-ctx.Done():
				t.Fatal("storage did not receive Read")
			}
			_, err = client.Search(ctx, &resourcepb.ResourceSearchRequest{})
			require.NoError(t, err)
			select {
			case method := <-searchCalls:
				assert.Equal(t, "/resource.ResourceIndex/Search", method)
			case <-ctx.Done():
				t.Fatal("search did not receive Search")
			}

			before := exchanges.Load()
			for _, deniedCtx := range []context.Context{
				context.Background(),
				identity.WithRequester(context.Background(), &identity.StaticRequester{Type: types.TypeUser, Namespace: "stacks-11"}),
			} {
				deniedCtx, cancel := context.WithTimeout(deniedCtx, time.Second)
				_, err = client.Read(deniedCtx, &resourcepb.ReadRequest{})
				cancel()
				require.ErrorContains(t, err, "denied request")
			}
			assert.Equal(t, before, exchanges.Load(), "denied requests must not reach token exchange")
			assert.Empty(t, storageCalls)
			assert.Empty(t, searchCalls)
		})
	}
}

func TestRemoteResourceClientRequiresTokenExchangeConfig(t *testing.T) {
	for _, tc := range []struct{ name, token, exchangeURL, wantError string }{
		{name: "missing token", exchangeURL: "https://exchange.example", wantError: "missing required token"},
		{name: "missing exchange URL", token: "service-token", wantError: "missing required token exchange url"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			auth := cfg.Raw.Section("grpc_client_authentication")
			auth.Key("token").SetValue(tc.token)
			auth.Key("token_exchange_url").SetValue(tc.exchangeURL)
			_, err := NewRemoteResourceClient(cfg, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
			require.ErrorContains(t, err, tc.wantError)
		})
	}
}

func TestRemoteResourceClientVerifiesExchangeTLS(t *testing.T) {
	for _, tc := range []struct {
		name, env, wantError string
		maxTLS               uint16
	}{
		{name: "production rejects untrusted certificate", env: setting.Prod, maxTLS: tls.VersionTLS13, wantError: "certificate"},
		{name: "development rejects TLS 1.2", env: setting.Dev, maxTLS: tls.VersionTLS12, wantError: "protocol version"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var exchanges atomic.Int32
			exchange := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				exchanges.Add(1)
				w.WriteHeader(http.StatusInternalServerError)
			}))
			exchange.TLS = &tls.Config{MinVersion: tls.VersionTLS12, MaxVersion: tc.maxTLS}
			exchange.StartTLS()
			t.Cleanup(exchange.Close)
			cfg := setting.NewCfg()
			cfg.Env = tc.env
			cfg.Raw.Section("grafana-apiserver").Key("address").SetValue("localhost:12345")
			auth := cfg.Raw.Section("grpc_client_authentication")
			auth.Key("token").SetValue("service-token")
			auth.Key("token_exchange_url").SetValue(exchange.URL)
			client, err := NewRemoteResourceClient(cfg, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: types.TypeUser, AccessToken: "caller-token", Namespace: "stacks-11"})
			_, err = client.Read(ctx, &resourcepb.ReadRequest{})
			require.ErrorContains(t, err, tc.wantError)
			assert.Zero(t, exchanges.Load(), "rejected TLS connections must not receive credentials")
		})
	}
}
