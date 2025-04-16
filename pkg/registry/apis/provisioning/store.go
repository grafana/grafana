package provisioning

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// SupplierHack Avoids circular dependencies in wire setup
type SupplierHack struct{}

func NewSupplierHack() apistore.ProvisioningSupplier {
	return &SupplierHack{}
}

var instance apistore.ProvisionedObjectStorage

func (s *SupplierHack) GetProvisionedObjectStorage() apistore.ProvisionedObjectStorage {
	return instance
}

// CreateProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) CreateProvisionedObject(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// DeleteProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) DeleteProvisionedObject(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// UpdateProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) UpdateProvisionedObject(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}
