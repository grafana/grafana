package provisioning

import (
	"fmt"
	"time"

	"k8s.io/client-go/tools/cache"

	provisioningInformer "github.com/grafana/grafana/pkg/generated/informers/externalversions/provisioning/v0alpha1"
)

var (
	_ cache.ResourceEventHandler = (*repositoryInformer)(nil)
)

type repositoryInformer struct {
	// TODO... other dependencies
}

func (r *repositoryInformer) init() error {
	xxx := provisioningInformer.NewRepositoryInformer(nil, "default", time.Second*60, nil)

	_, err := xxx.AddEventHandler(r)

	return err
}

// OnAdd implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnAdd(obj any, isInInitialList bool) {
	fmt.Printf("OnADD: %v / %v\n", isInInitialList, obj)
}

// OnDelete implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnDelete(obj any) {
	fmt.Printf("OnDelete: %v\n", obj)
}

// OnUpdate implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnUpdate(oldObj any, newObj any) {
	fmt.Printf("OnUpdate: %v\n", newObj)
}
