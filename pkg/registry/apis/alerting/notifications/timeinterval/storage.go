package timeinterval

import (
	"k8s.io/apiserver/pkg/registry/rest"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func NewStorage(
	legacySvc TimeIntervalService,
	namespacer request.NamespaceMapper,
	opts builder.APIGroupOptions,
) (rest.Storage, error) {
	legacyStore := &legacyStorage{
		service:        legacySvc,
		namespacer:     namespacer,
		tableConverter: ResourceInfo.TableConverter(),
	}
	if opts.OptsGetter != nil && opts.DualWriteBuilder != nil {
		store, err := grafanaregistry.NewRegistryStore(opts.Scheme, ResourceInfo, opts.OptsGetter)
		if err != nil {
			return nil, err
		}
		return opts.DualWriteBuilder(ResourceInfo.GroupResource(), legacyStore, store)
	}
	return legacyStore, nil
}
