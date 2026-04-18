package rest

import "k8s.io/apiserver/pkg/registry/rest"

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
//
//go:generate mockery --name Storage --structname MockStorage --inpackage --filename storage_mock.go --with-expecter
type Storage interface {
	rest.Storage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
	rest.Getter
	rest.Lister
	rest.CreaterUpdater
	rest.GracefulDeleter
	rest.CollectionDeleter
}
