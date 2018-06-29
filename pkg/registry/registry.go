package registry

import (
	"context"
	"reflect"
	"sort"
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

type BackgroundService interface {
	Run(ctx context.Context) error
}

type HasInitPriority interface {
	GetInitPriority() Priority
}

func IsDisabled(srv Service) bool {
	canBeDisabled, ok := srv.(CanBeDisabled)
	return ok && canBeDisabled.IsDisabled()
}

type Priority int

const (
	High Priority = 100
	Low  Priority = 0
)
