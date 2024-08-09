package dashboard

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
)

type blobStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

var (
	_ rest.RESTUpdateStrategy = (*blobStrategy)(nil)
	_ rest.RESTCreateStrategy = (*blobStrategy)(nil)
	_ rest.RESTDeleteStrategy = (*blobStrategy)(nil)
)

func NewBlobStrategy(typer runtime.ObjectTyper) blobStrategy {
	return blobStrategy{typer, names.SimpleNameGenerator}
}

// NamespaceScoped returns true because all Generic resources must be within a namespace.
func (blobStrategy) NamespaceScoped() bool {
	return true
}

func (blobStrategy) BeginCreateFunc(ctx context.Context, obj runtime.Object) {
	fmt.Printf("CREATE: %t // %+v\n", obj, obj)
}

func (blobStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	fmt.Printf("CREATE: %t // %+v\n", obj, obj)
}

func (blobStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	fmt.Printf("UPDATE: %t // %+v\n", obj, obj)
}

func (blobStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (blobStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string { return nil }

func (blobStrategy) AllowCreateOnUpdate() bool {
	return true
}

func (blobStrategy) AllowUnconditionalUpdate() bool {
	return true
}

func (blobStrategy) Canonicalize(obj runtime.Object) {}

func (blobStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (blobStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}
