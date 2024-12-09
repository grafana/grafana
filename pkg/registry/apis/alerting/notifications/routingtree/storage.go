package routingtree

import (
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func NewStorage(legacySvc RouteService, namespacer request.NamespaceMapper) (rest.Storage, error) {
	legacyStore := &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
	}
	// TODO implement dual write for routes. This API is a special beast - the resource is singleton.
	return legacyStore, nil
}
