package dskitadapter

import (
	"context"
	"reflect"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/registry"
)

var _ services.NamedService = &serviceAdapter{}

type serviceAdapter struct {
	*services.BasicService
	name    string
	service registry.BackgroundService
}

func asNamedService(service registry.BackgroundService) *serviceAdapter {
	name := reflect.TypeOf(service).String()
	a := &serviceAdapter{
		name:    name,
		service: service,
	}
	a.BasicService = services.NewBasicService(a.start, a.run, nil).WithName(name)
	return a
}

func (a *serviceAdapter) start(ctx context.Context) error {
	return nil
}

func (a *serviceAdapter) run(ctx context.Context) error {
	err := a.service.Run(ctx)
	if err != nil {
		return err
	}
	<-ctx.Done()
	return nil
}
