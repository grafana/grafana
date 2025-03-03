package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
)

var _ genericregistry.RESTOptionsGetter = &dashboardOptsGetter{}

type dashboardOptsGetter struct {
	optsGetter       genericregistry.RESTOptionsGetter
	encoderVersioner runtime.GroupVersioner
}

func (d *dashboardOptsGetter) GetRESTOptions(resource schema.GroupResource, example runtime.Object) (genericregistry.RESTOptions, error) {
	opts, err := d.optsGetter.GetRESTOptions(resource, example)
	if err != nil {
		return genericregistry.RESTOptions{}, err
	}
	// this ensures that the dashboard resource is encoded at v0alpha1
	opts.StorageConfig.EncodeVersioner = d.encoderVersioner
	return opts, nil
}
