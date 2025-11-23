package testcontainer

import (
	"context"
	"fmt"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/network"
)

// Scenario manages a test scenario with containers and a shared network.
type Scenario struct {
	ctx         context.Context
	networkName string
	network     *testcontainers.DockerNetwork
	containers  []testcontainers.Container
}

// NewScenario creates a new test scenario with a dedicated network.
func NewScenario(ctx context.Context, networkName string) (*Scenario, error) {
	// Create a Docker network for container communication
	net, err := network.New(ctx, network.WithDriver("bridge"))
	if err != nil {
		return nil, fmt.Errorf("failed to create network: %w", err)
	}

	return &Scenario{
		ctx:         ctx,
		networkName: networkName,
		network:     net,
		containers:  make([]testcontainers.Container, 0),
	}, nil
}

// NetworkName returns the network name.
func (s *Scenario) NetworkName() string {
	return s.networkName
}

// Network returns the Docker network.
func (s *Scenario) Network() *testcontainers.DockerNetwork {
	return s.network
}

// Context returns the scenario context.
func (s *Scenario) Context() context.Context {
	return s.ctx
}

// RegisterContainer adds a container to the scenario's list for cleanup.
func (s *Scenario) RegisterContainer(container testcontainers.Container) {
	s.containers = append(s.containers, container)
}

// StartAndWaitReady starts all containers that implement ReadinessChecker.
func (s *Scenario) StartAndWaitReady(services ...Service) error {
	for _, svc := range services {
		if err := svc.Start(s.ctx); err != nil {
			return fmt.Errorf("failed to start service: %w", err)
		}
		s.RegisterContainer(svc.Container())
	}
	return nil
}

// Close terminates all containers and cleans up resources.
func (s *Scenario) Close() error {
	var errs []error

	// Stop and remove all containers
	for _, container := range s.containers {
		if err := container.Terminate(s.ctx); err != nil {
			errs = append(errs, err)
		}
	}

	// Remove the network
	if s.network != nil {
		if err := s.network.Remove(s.ctx); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors during cleanup: %v", errs)
	}
	return nil
}
