package rest

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"

	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation"
	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation/v0alpha1"
	aggregatorscheme "github.com/grafana/grafana/pkg/aggregator/apiserver/scheme"
	dataplaneservicestorage "github.com/grafana/grafana/pkg/aggregator/registry/dataplaneservice/storage"
)

// NewRESTStorage returns an APIGroupInfo object that will work against dataplaneservice.
func NewRESTStorage(apiResourceConfigSource serverstorage.APIResourceConfigSource, restOptionsGetter generic.RESTOptionsGetter, shouldServeBeta bool) genericapiserver.APIGroupInfo {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(aggregation.GROUP, aggregatorscheme.Scheme, metav1.ParameterCodec, aggregatorscheme.Codecs)

	storage := map[string]rest.Storage{}

	if resource := "dataplaneservices"; apiResourceConfigSource.ResourceEnabled(v0alpha1.SchemeGroupVersion.WithResource(resource)) {
		dataplaneServiceREST := dataplaneservicestorage.NewREST(aggregatorscheme.Scheme, restOptionsGetter)
		storage[resource] = dataplaneServiceREST
		storage[resource+"/status"] = dataplaneservicestorage.NewStatusREST(aggregatorscheme.Scheme, dataplaneServiceREST)
	}

	if len(storage) > 0 {
		apiGroupInfo.VersionedResourcesStorageMap["v0alpha1"] = storage
	}

	return apiGroupInfo
}
