package e2eservices

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/docker/go-connections/nat"
	"github.com/grafana/grafana/pkg/extensions/apiserver/apiserver_test/testcontainer"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/grafana/grafana/pkg/services/apiserver/apiserver_test/util"
)

const (
	grafanaHTTPPort = 3000
	devK8sPort      = 6443 // used with loopback config to avoid the need to provision GLSA tokens
	grafanaGRPCPort = 10000
)

type GrafanaService struct {
	testcontainer.BaseService
	container testcontainers.Container
	name      string
	envVars   map[string]string
	network   *testcontainers.DockerNetwork
	files     []testcontainers.ContainerFile
	workDir   string
	tempDir   string
}

func NewGrafanaService(name, workDir, tempDir string, flags, envVars map[string]string, network *testcontainers.DockerNetwork, files []testcontainers.ContainerFile) *GrafanaService {
	return &GrafanaService{
		name:    name,
		workDir: workDir,
		tempDir: tempDir,
		envVars: envVars,
		network: network,
		files:   files,
	}
}

func (g *GrafanaService) Start(ctx context.Context) error {
	// Build command arguments from flags
	args := []string{}
	// Note: flags are not used in the original implementation for Grafana

	// Prepare environment variables
	env := make(map[string]string)
	for k, v := range g.envVars {
		env[k] = v
	}

	req := testcontainers.ContainerRequest{
		Image:        util.GetGrafanaImage(),
		Cmd:          args,
		Env:          env,
		ExposedPorts: []string{fmt.Sprintf("%d/tcp", grafanaHTTPPort), fmt.Sprintf("%d/tcp", grafanaGRPCPort), fmt.Sprintf("%d/tcp", devK8sPort)},
		Networks:     []string{g.network.Name},
		NetworkAliases: map[string][]string{
			g.network.Name: {g.name},
		},
		WaitingFor: wait.ForHTTP("/api/health").
			WithPort(nat.Port(fmt.Sprintf("%d/tcp", grafanaHTTPPort))).
			WithStatusCodeMatcher(func(status int) bool {
				return status >= 200 && status <= 299
			}).WithStartupTimeout(120 * time.Second),
		Files: g.files,
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		return fmt.Errorf("failed to start Grafana container: %w", err)
	}

	g.container = container
	g.BaseService = testcontainer.BaseService{}
	return nil
}

// GetKubeconfigPath returns the path to the kubeconfig file on the host filesystem
func (g *GrafanaService) GetKubeconfigPath() string {
	return filepath.Join(g.tempDir, "grafana.kubeconfig")
}

// GetKubeconfig retrieves the kubeconfig file from the container and caches it to the host filesystem
func (g *GrafanaService) GetKubeconfig(ctx context.Context) ([]byte, error) {
	kubeconfigPath := g.GetKubeconfigPath()

	// Check if file already exists on host
	kubeconfigBytes, err := os.ReadFile(kubeconfigPath) // #nosec G304 -- this is a test file reading from a controlled temp directory
	if err == nil {
		return kubeconfigBytes, nil
	}

	// File doesn't exist yet, try to copy it from the container
	kubeconfigDir := filepath.Join(g.tempDir)
	if err := os.MkdirAll(kubeconfigDir, 0750); err != nil {
		return nil, fmt.Errorf("failed to create kubeconfig directory: %w", err)
	}

	possiblePaths := []string{
		"/var/lib/grafana/grafana-apiserver/grafana.kubeconfig",
	}

	var reader io.ReadCloser
	var lastErr error
	for _, containerPath := range possiblePaths {
		// Use CopyFileFromContainer to avoid exec stream multiplexing issues
		reader, err = g.container.CopyFileFromContainer(ctx, containerPath)
		if err == nil {
			break
		}
		lastErr = err
	}

	if reader == nil {
		return nil, fmt.Errorf("failed to copy file from container (tried %v): %w", possiblePaths, lastErr)
	}
	defer func() {
		_ = reader.Close()
	}()

	// Extract the file from the tar archive
	loopbackConfig, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read file from container: %w", err)
	}

	// Persist loopbackConfig to disk for future reads
	if err := os.WriteFile(kubeconfigPath, loopbackConfig, 0644); err != nil {
		return nil, fmt.Errorf("failed to write kubeconfig to disk: %w", err)
	}

	return loopbackConfig, nil
}

func (g *GrafanaService) Container() testcontainers.Container {
	return g.container
}

func (g *GrafanaService) Endpoint(port int) string {
	if g.container == nil {
		return ""
	}
	ctx := context.Background()
	host, err := g.container.Host(ctx)
	if err != nil {
		return ""
	}
	mappedPort, err := g.container.MappedPort(ctx, nat.Port(fmt.Sprintf("%d/tcp", port)))
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s:%s", host, mappedPort.Port())
}

func (g *GrafanaService) NetworkEndpoint(port int) string {
	return fmt.Sprintf("%s:%d", g.name, port)
}

func (g *GrafanaService) HTTPEndpoint() string {
	return g.Endpoint(grafanaHTTPPort)
}

func (g *GrafanaService) DevK8sEndpoint() string {
	return g.Endpoint(devK8sPort)
}

func (g *GrafanaService) GRPCEndpoint() string {
	return g.NetworkEndpoint(grafanaGRPCPort)
}
