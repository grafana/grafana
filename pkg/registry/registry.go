package registry

import "context"

var services = []Service{}

func RegisterService(srv Service) {
	services = append(services, srv)
}

func GetServices() []Service {
	return services

}

type Service interface {
	Init() error
	Run(ctx context.Context) error
}
