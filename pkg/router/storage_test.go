package router

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestRemoteResourceClientTokenExchange(t *testing.T) {
	for _, separateSearch := range []bool{false, true} {
		name := "shared storage and search"
		if separateSearch {
			name = "separate search server"
		}
		t.Run(name, func(t *testing.T) {
			exchange := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
					assert.Contains(t, md.Get("x-access-token"), "obo-token")
					method, _ := grpc.MethodFromServerStream(stream)
					calls <- method
					return stream.SendMsg(&resourcepb.ReadResponse{})
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
			assert.Contains(t, <-storageCalls, "ResourceStore/Read")
			_, err = client.Search(ctx, &resourcepb.ResourceSearchRequest{})
			require.NoError(t, err)
			assert.Contains(t, <-searchCalls, "ResourceIndex/Search")

			_, err = client.Read(context.Background(), &resourcepb.ReadRequest{})
			require.Error(t, err)
			assert.Empty(t, storageCalls)
		})
	}
}

func TestRemoteResourceClientRequiresTokenExchangeConfig(t *testing.T) {
	for _, token := range []string{"", "service-token"} {
		cfg := setting.NewCfg()
		cfg.Raw.Section("grpc_client_authentication").Key("token").SetValue(token)
		_, err := NewRemoteResourceClient(cfg, noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry())
		require.ErrorContains(t, err, "error creating token exchange client")
	}
}
