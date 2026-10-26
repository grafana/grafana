package server

import (
	"testing"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

func TestModuleServerDependencies(t *testing.T) {
	t.Run("are nil before the modules that create them are initialized", func(t *testing.T) {
		s := &ModuleServer{}
		require.Nil(t, s.HTTPRouter())
		require.Nil(t, s.GRPCServer())
	})

	t.Run("are the module server's own", func(t *testing.T) {
		router := mux.NewRouter()
		health := NewHealthNotifier()
		grpcService, err := grpcserver.ProvideDSKitService(setting.NewCfg(), noop.NewTracerProvider().Tracer("test"), prometheus.NewRegistry(), "grpc-server")
		require.NoError(t, err)
		s := &ModuleServer{httpServerRouter: router, healthNotifier: health, grpcService: grpcService}
		require.Same(t, router, s.HTTPRouter())
		require.Same(t, health, s.ReadyNotifier())
		require.Same(t, grpcService.GetServer(), s.GRPCServer())
	})
}
