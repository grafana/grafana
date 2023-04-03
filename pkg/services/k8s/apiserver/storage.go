package apiserver

import (
	"context"
	"fmt"

	customStorage "k8s.io/apiextensions-apiserver/pkg/storage"
	"k8s.io/apiextensions-apiserver/pkg/storage/filepath"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ customStorage.Storage = (*Storage)(nil)

// wrap the filepath storage so we can test overriding functions
type Storage struct {
	customStorage.Storage
}

// this is called before the apiserver starts up
var NewStorage customStorage.NewStorageFunc = func(
	gr schema.GroupResource,
	strategy customStorage.Strategy,
	optsGetter generic.RESTOptionsGetter,
	tableConvertor rest.TableConvertor,
	newFunc, newListFunc customStorage.NewObjectFunc,
) (customStorage.Storage, error) {
	s, err := filepath.Storage(gr, strategy, optsGetter, tableConvertor, newFunc, newListFunc)
	if err != nil {
		return nil, err
	}

	return &Storage{s}, nil
}

// test to override the storage function from the filepath storage
func (s *Storage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	user, ok := request.UserFrom(ctx)
	if ok {
		fmt.Printf("\n\nK8s storage user: %+v\n\n", user)
	}
	return s.Storage.Create(ctx, obj, createValidation, options)
}
