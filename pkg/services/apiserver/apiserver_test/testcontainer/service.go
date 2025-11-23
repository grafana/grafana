package testcontainer

import (
	"context"
	"fmt"

	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go"
)

// Service represents a testcontainer service.
type Service interface {
	// Start starts the container
	Start(ctx context.Context) error
	// Container returns the underlying testcontainer
	Container() testcontainers.Container
	// Endpoint returns the network endpoint for the specified port
	Endpoint(port int) string
	// NetworkEndpoint returns the internal network endpoint for the specified port
	NetworkEndpoint(port int) string
}

// BaseService provides common functionality for testcontainer services.
type BaseService struct {
	container testcontainers.Container
	name      string
}

// Container returns the underlying testcontainer.
func (b *BaseService) Container() testcontainers.Container {
	return b.container
}

// Endpoint returns the mapped host endpoint for a container port.
func (b *BaseService) Endpoint(port int) string {
	if b.container == nil {
		return ""
	}
	ctx := context.Background()
	host, err := b.container.Host(ctx)
	if err != nil {
		return ""
	}
	mappedPort, err := b.container.MappedPort(ctx, nat.Port(fmt.Sprintf("%d/tcp", port)))
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s:%s", host, mappedPort.Port())
}

// NetworkEndpoint returns the internal network endpoint for a container port.
func (b *BaseService) NetworkEndpoint(port int) string {
	return fmt.Sprintf("%s:%d", b.name, port)
}

// HTTPEndpoint returns the HTTP endpoint.
func (b *BaseService) HTTPEndpoint() string {
	// This will be overridden by specific services
	return ""
}
