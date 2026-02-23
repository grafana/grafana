package repository

import (
	"context"
	"fmt"
	"sort"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

type Mutator func(ctx context.Context, obj runtime.Object) error

//go:generate mockery --name=Extra --structname=MockExtra --inpackage --filename=extra_mock.go --with-expecter
type Extra interface {
	Type() provisioning.RepositoryType
	Build(ctx context.Context, r *provisioning.Repository) (Repository, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) field.ErrorList
}

//go:generate mockery --name=Factory --structname=MockFactory --inpackage --filename=factory_mock.go --with-expecter
type Factory interface {
	Types() []provisioning.RepositoryType
	Build(ctx context.Context, r *provisioning.Repository) (Repository, error)
	Mutate(ctx context.Context, obj runtime.Object) error
	Validate(ctx context.Context, obj runtime.Object) field.ErrorList
}

type factory struct {
	extras  map[provisioning.RepositoryType]Extra
	enabled map[provisioning.RepositoryType]struct{}
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
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}

	// Find the extra that matches this repository type
	for _, e := range f.extras {
		if e.Type() == repo.Spec.Type {
			return e.Mutate(ctx, obj)
		}
	}

	// No matching extra found - this will be caught by Validate
	return nil
}

func (f *factory) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	var list field.ErrorList

	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return list
	}

	// Check if repository type is supported
	var foundExtra Extra
	for _, e := range f.extras {
		if e.Type() == repo.Spec.Type {
			foundExtra = e
			break
		}
	}
	if foundExtra == nil {
		list = append(list, field.Invalid(
			field.NewPath("spec", "type"),
			repo.Spec.Type,
			fmt.Sprintf("repository type %q is not supported", repo.Spec.Type),
		))
		// Return early if type is not supported - no point validating further
		return list
	}

	// Check if repository type is enabled
	if _, enabled := f.enabled[repo.Spec.Type]; !enabled {
		list = append(list, field.Invalid(
			field.NewPath("spec", "type"),
			repo.Spec.Type,
			fmt.Sprintf("repository type %q is not enabled", repo.Spec.Type),
		))
		// Return early if type is not enabled - no point validating further
		return list
	}

	// Validate using the matching extra
	list = append(list, foundExtra.Validate(ctx, obj)...)

	return list
}
