package legacypermissions

import (
	"time"

	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// InstrumentServer measures complete handler execution, including response streaming.
// Register each implementation once per registry.
func InstrumentServer(server authzv1.LegacyAuthzServiceServer, reg prometheus.Registerer, implementation string) authzv1.LegacyAuthzServiceServer {
	if implementation != "embedded" && implementation != "remote" {
		panic("invalid legacy permissions implementation")
	}
	duration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:        "grafana_authz_legacy_get_user_permissions_duration_seconds",
		Help:        "Time spent handling LegacyGetUserPermissions requests, including response streaming.",
		Buckets:     prometheus.ExponentialBuckets(0.00001, 4, 10),
		ConstLabels: prometheus.Labels{"implementation": implementation},
	}, []string{"status"})
	duration.WithLabelValues("ok")
	duration.WithLabelValues("error")
	return &instrumentedServer{LegacyAuthzServiceServer: server, duration: duration}
}

type instrumentedServer struct {
	authzv1.LegacyAuthzServiceServer
	duration *prometheus.HistogramVec
}

func (s *instrumentedServer) LegacyGetUserPermissions(req *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) (err error) {
	started := time.Now()
	completed := false
	defer func() {
		result := "error"
		if completed && err == nil {
			result = "ok"
		}
		s.duration.WithLabelValues(result).Observe(time.Since(started).Seconds())
	}()
	err = s.LegacyAuthzServiceServer.LegacyGetUserPermissions(req, stream)
	completed = true
	return err
}
