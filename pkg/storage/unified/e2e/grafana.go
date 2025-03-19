package e2e

import (
	"fmt"
	"net/url"
	"os"

	"github.com/grafana/e2e"
	gapi "github.com/grafana/grafana-api-golang-client"
)

const (
	grafanaINI = `
app_mode = development
target = all

[grafana-apiserver]
address = 0.0.0.0:10000
storage_type = unified-grpc

[unified_storage.dashboards.dashboard.grafana.app]
dualWriterMode = 5

[unified_storage.folders.folder.grafana.app]
dualWriterMode = 5
`
	defaultGrafanaImage = "grafana/grafana:main"
	grafanaBinary       = "/run.sh"
	grafanaHTTPPort     = 3000
	grafanaGRPCPort     = 10000
)

type GrafanaService struct {
	*e2e.HTTPService
}

func NewGrafanaService(name string, flags, envVars map[string]string) *GrafanaService {
	svc := &GrafanaService{
		HTTPService: e2e.NewHTTPService(
			name,
			GetGrafanaImage(),
			e2e.NewCommandWithoutEntrypoint(grafanaBinary, e2e.BuildArgs(flags)...),
			e2e.NewHTTPReadinessProbe(grafanaHTTPPort, "/ready", 200, 299),
			grafanaHTTPPort,
			grafanaGRPCPort),
	}

	svc.ConcreteService.SetEnvVars(envVars)

	return svc
}

func (g *GrafanaService) GRPCEndpoint() string {
	return g.HTTPService.NetworkEndpoint(grafanaGRPCPort)
}

type GrafanaClient struct {
	*gapi.Client
}

func NewGrafanaClient(host string, orgID int64) (*GrafanaClient, error) {
	cfg := gapi.Config{
		BasicAuth: url.UserPassword("admin", "admin"),
		OrgID:     orgID,
		HTTPHeaders: map[string]string{
			"X-Disable-Provenance": "true",
		},
	}

	client, err := gapi.New(fmt.Sprintf("http://%s/", host), cfg)
	if err != nil {
		return nil, err
	}

	return &GrafanaClient{
		Client: client,
	}, nil
}

// GetDefaultImage returns the Docker image to use to run the Grafana..
func GetGrafanaImage() string {
	if img := os.Getenv("GRAFANA_IMAGE"); img != "" {
		return img
	}

	return defaultGrafanaImage
}
