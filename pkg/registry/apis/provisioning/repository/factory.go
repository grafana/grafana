package repository

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"sort"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
	extras map[provisioning.RepositoryType]Extra
}

func ProvideFactory(extras []Extra) (Factory, error) {
	f := &factory{
		extras: make(map[provisioning.RepositoryType]Extra, len(extras)),
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
	types := slices.Collect(maps.Keys(f.extras))
	sort.Slice(types, func(i, j int) bool {
		return string(types[i]) < string(types[j])
	})
	return types
}

func (f *factory) Build(ctx context.Context, r *provisioning.Repository) (Repository, error) {
	for _, e := range f.extras {
		if e.Type() == r.Spec.Type {
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
