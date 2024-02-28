package aggregator

import (
	"fmt"
	"net"
	"net/url"

	"k8s.io/kube-aggregator/pkg/apiserver"

	servicelistersv0alpha1 "github.com/grafana/grafana/pkg/apps/service/generated/listers/service/v0alpha1"
)

func NewExternalNameResolver(externalNames servicelistersv0alpha1.ExternalNameLister) apiserver.ServiceResolver {
	return &externalNameResolver{
		externalNames: externalNames,
	}
}

type externalNameResolver struct {
	externalNames servicelistersv0alpha1.ExternalNameLister
}

func (r *externalNameResolver) ResolveEndpoint(namespace, name string, port int32) (*url.URL, error) {
	extName, err := r.externalNames.ExternalNames(namespace).Get(name)
	if err != nil {
		return nil, err
	}
	return &url.URL{
		Scheme: "https",
		Host:   net.JoinHostPort(extName.Spec.Host, fmt.Sprintf("%d", port)),
	}, nil
}
