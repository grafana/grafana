package alertmanager

import (
	"fmt"
	"net/url"

	"github.com/grafana/e2e"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	mimirImage = "grafana/mimir:r348-017076d8"

	mimirBinary   = "/bin/mimir"
	mimirHTTPPort = 33667
	mimirGRPCPort = 33668
)

type MimirService struct {
	*e2e.HTTPService
}

func NewMimirService(name string) *MimirService {
	flags := map[string]string{
		"-target":                                                  "alertmanager",
		"-server.http-listen-port":                                 fmt.Sprintf("%d", mimirHTTPPort),
		"-server.grpc-listen-port":                                 fmt.Sprintf("%d", mimirGRPCPort),
		"-alertmanager.web.external-url":                           "http://localhost:8080/alertmanager",
		"-alertmanager-storage.backend":                            "filesystem",
		"-alertmanager-storage.filesystem.dir":                     "/tmp/mimir/alertmanager",
		"-alertmanager.grafana-alertmanager-compatibility-enabled": "true",
	}

	return &MimirService{
		HTTPService: e2e.NewHTTPService(
			name,
			mimirImage,
			e2e.NewCommandWithoutEntrypoint(mimirBinary, e2e.BuildArgs(flags)...),
			e2e.NewHTTPReadinessProbe(mimirHTTPPort, "/ready", 200, 299),
			mimirHTTPPort,
		),
	}
}

func NewMimirClient(mimirURL, tenantID string) (client.MimirClient, error) {
	u, err := url.Parse(mimirURL)
	if err != nil {
		return nil, err
	}

	cfg := &client.Config{
		URL:      u,
		TenantID: tenantID,
		Password: "", // No password needed for test
		Logger:   log.NewNopLogger(),
	}

	registry := prometheus.NewRegistry()
	metrics := metrics.NewRemoteAlertmanagerMetrics(registry)
	tracer := tracing.InitializeTracerForTest()

	return client.New(cfg, metrics, tracer)
}
