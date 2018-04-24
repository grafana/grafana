package registry

import (
	"context"
)

var services = []Service{}

func RegisterService(srv Service) {
	services = append(services, srv)
}

func GetServices() []Service {
	return services
}

type Service interface {
	Init() error
}

// Useful for alerting service
type CanBeDisabled interface {
	IsDisabled() bool
}

type BackgroundService interface {
	Run(ctx context.Context) error
}

func IsDisabled(srv Service) bool {
	canBeDisabled, ok := srv.(CanBeDisabled)
	return ok && canBeDisabled.IsDisabled()
}
