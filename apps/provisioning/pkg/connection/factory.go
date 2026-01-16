package connection

import (
	"context"
	"fmt"
	"sort"

	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

//go:generate mockery --name=Extra --structname=MockExtra --inpackage --filename=extra_mock.go --with-expecter
type Extra interface {
	Type() provisioning.ConnectionType
	Build(ctx context.Context, r *provisioning.Connection) (Connection, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) error
}

//go:generate mockery --name=Factory --structname=MockFactory --inpackage --filename=factory_mock.go --with-expecter
type Factory interface {
	Types() []provisioning.ConnectionType
	Build(ctx context.Context, r *provisioning.Connection) (Connection, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) error
}

type factory struct {
	extras  map[provisioning.ConnectionType]Extra
	enabled map[provisioning.ConnectionType]struct{}
}

func ProvideFactory(enabled map[provisioning.ConnectionType]struct{}, extras []Extra) (Factory, error) {
	f := &factory{
		enabled: enabled,
		extras:  make(map[provisioning.ConnectionType]Extra, len(extras)),
	}

	for _, e := range extras {
		if _, exists := f.extras[e.Type()]; exists {
			return nil, fmt.Errorf("connection type %q is already registered", e.Type())
		}
		f.extras[e.Type()] = e
	}

	return f, nil
}

func (f *factory) Types() []provisioning.ConnectionType {
	var types []provisioning.ConnectionType
	for t := range f.enabled {
		if _, exists := f.extras[t]; exists {
			types = append(types, t)
		}
	}

	sort.Slice(types, func(i, j int) bool {
		return string(types[i]) < string(types[j])
	})

	return types
}

func (f *factory) Build(ctx context.Context, c *provisioning.Connection) (Connection, error) {
	for _, e := range f.extras {
		if e.Type() == c.Spec.Type {
			if _, enabled := f.enabled[e.Type()]; !enabled {
				return nil, fmt.Errorf("connection type %q is not enabled", e.Type())
			}

			return e.Build(ctx, c)
		}
	}

	return nil, fmt.Errorf("connection type %q is not supported", c.Spec.Type)
}

func (f *factory) Mutate(ctx context.Context, obj runtime.Object) error {
	for _, e := range f.extras {
		if err := e.Mutate(ctx, obj); err != nil {
			return err
		}
	}
	return nil
}

func (f *factory) Validate(ctx context.Context, obj runtime.Object) error {
	for _, e := range f.extras {
		if err := e.Validate(ctx, obj); err != nil {
			return err
		}
	}
	return nil
}

var (
	_ Factory = (*factory)(nil)
)
