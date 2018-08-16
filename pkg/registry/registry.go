package registry

import (
	"context"
	"reflect"
	"sort"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type Descriptor struct {
	Name         string
	Instance     Service
	InitPriority Priority
}

var services []*Descriptor

func RegisterService(instance Service) {
	services = append(services, &Descriptor{
		Name:         reflect.TypeOf(instance).Elem().Name(),
		Instance:     instance,
		InitPriority: Low,
	})
}

func Register(descriptor *Descriptor) {
	services = append(services, descriptor)
}

func GetServices() []*Descriptor {
	sort.Slice(services, func(i, j int) bool {
		return services[i].InitPriority > services[j].InitPriority
	})

	return services
}

// Service interface is the lowest common shape that services
// are expected to forfill to be started within Grafana.
type Service interface {

	// Init is called by Grafana main process which gives the service
	// the possibility do some initial work before its started. Things
	// like adding routes, bus handlers should be done in the Init function
	Init() error
}

// CanBeDisabled allows the services to decide if it should
// be started or not by itself. This is useful for services
// that might not always be started, ex alerting.
// This will be called after `Init()`.
type CanBeDisabled interface {

	// IsDisabled should return a bool saying if it can be started or not.
	IsDisabled() bool
}

// BackgroundService should be implemented for services that have
// long running tasks in the background.
type BackgroundService interface {
	// Run starts the background process of the service after `Init` have been called
	// on all services. The `context.Context` passed into the function should be used
	// to subscribe to ctx.Done() so the service can be notified when Grafana shuts down.
	Run(ctx context.Context) error
}

// DatabaseMigrator allows the caller to add migrations to
// the migrator passed as argument
type DatabaseMigrator interface {

	// AddMigrations allows the service to add migrations to
	// the database migrator.
	AddMigration(mg *migrator.Migrator)
}

// IsDisabled takes an service and return true if its disabled
func IsDisabled(srv Service) bool {
	canBeDisabled, ok := srv.(CanBeDisabled)
	return ok && canBeDisabled.IsDisabled()
}

type Priority int

const (
	High Priority = 100
	Low  Priority = 0
)
