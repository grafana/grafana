package repository

import (
	"context"
	"fmt"
	"sort"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime"
)

type Mutator func(ctx context.Context, obj runtime.Object) error

//go:generate mockery --name=Extra --structname=MockExtra --inpackage --filename=extra_mock.go --with-expecter
type Extra interface {
	Type() provisioning.RepositoryType
	Build(ctx context.Context, r *provisioning.Repository) (Repository, error)
	Mutate(ctx context.Context, obj runtime.Object) error
}

//go:generate mockery --name=Factor --structname=MockFactory --inpackage --filename=factory_mock.go --with-expecter
type Factory interface {
	Types() []provisioning.RepositoryType
	Build(ctx context.Context, r *provisioning.Repository) (Repository, error)
	Mutate(ctx context.Context, obj runtime.Object) error
}

type factory struct {
	extras  map[provisioning.RepositoryType]Extra
	enabled map[provisioning.RepositoryType]struct{}
}

func ProvideFactoryFromConfig(cfg *setting.Cfg, extras []Extra) (Factory, error) {
	enabledTypes := make(map[provisioning.RepositoryType]struct{}, len(cfg.ProvisioningRepositoryTypes))
	for _, e := range cfg.ProvisioningRepositoryTypes {
		enabledTypes[provisioning.RepositoryType(e)] = struct{}{}
	}

	return ProvideFactory(enabledTypes, extras)
}

func ProvideFactory(enabled map[provisioning.RepositoryType]struct{}, extras []Extra) (Factory, error) {
	f := &factory{
		enabled: enabled,
		extras:  make(map[provisioning.RepositoryType]Extra, len(extras)),
	}

	for _, e := range extras {
		if _, exists := f.extras[e.Type()]; exists {
			return nil, fmt.Errorf("repository type %q is already registered", e.Type())
		}
		f.extras[e.Type()] = e
	}

	return f, nil
}

func (f *factory) Types() []provisioning.RepositoryType {
	var types []provisioning.RepositoryType
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

func (f *factory) Build(ctx context.Context, r *provisioning.Repository) (Repository, error) {
	for _, e := range f.extras {
		if e.Type() == r.Spec.Type {
			if _, enabled := f.enabled[e.Type()]; !enabled {
				return nil, fmt.Errorf("repository type %q is not enabled", e.Type())
			}

			return e.Build(ctx, r)
		}
	}

	return nil, fmt.Errorf("repository type %q is not supported", r.Spec.Type)
}

func (f *factory) Mutate(ctx context.Context, obj runtime.Object) error {
	for _, e := range f.extras {
		if err := e.Mutate(ctx, obj); err != nil {
			return err
		}
	}

	return nil
}
