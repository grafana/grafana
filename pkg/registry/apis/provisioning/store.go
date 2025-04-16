package provisioning

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

type requestInfo struct {
	obj   utils.GrafanaMetaAccessor
	props utils.ManagerProperties
	repo  *resources.DualReadWriter
}

// CreateProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) CreateProvisionedObject(ctx context.Context, orig runtime.Object) error {
	req, err := b.prepareRequest(ctx, orig)
	if err != nil {
		return err
	}
	return fmt.Errorf("TODO... create: %v", req)
}

// UpdateProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) UpdateProvisionedObject(ctx context.Context, orig runtime.Object) error {
	req, err := b.prepareRequest(ctx, orig)
	if err != nil {
		return err
	}
	return fmt.Errorf("TODO... update: %v", req)
}

// DeleteProvisionedObject implements apistore.ProvisionedObjectStorage.
func (b *APIBuilder) DeleteProvisionedObject(ctx context.Context, orig runtime.Object) error {
	req, err := b.prepareRequest(ctx, orig)
	if err != nil {
		return err
	}
	return fmt.Errorf("TODO... delete: %v", req)
}

func (b *APIBuilder) prepareRequest(ctx context.Context, orig runtime.Object) (requestInfo, error) {
	obj, err := utils.MetaAccessor(orig)
	if err != nil {
		return requestInfo{}, err
	}
	props, ok := obj.GetManagerProperties()
	if !ok {
		return requestInfo{}, fmt.Errorf("expected the request to be to storage")
	}
	req := requestInfo{
		obj:   obj,
		props: props,
	}

	repo, err := b.GetHealthyRepository(ctx, props.Identity)
	if err != nil {
		return req, err
	}

	readWriter, ok := repo.(repository.ReaderWriter)
	if !ok {
		return req, apierrors.NewBadRequest("repository does not support read-writing")
	}

	parser, err := b.parsers.GetParser(ctx, readWriter)
	if err != nil {
		return req, fmt.Errorf("failed to get parser: %w", err)
	}

	clients, err := b.clients.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return req, fmt.Errorf("failed to get clients: %w", err)
	}

	folderClient, err := clients.Folder()
	if err != nil {
		return req, fmt.Errorf("failed to get folder client: %w", err)
	}
	folders := resources.NewFolderManager(readWriter, folderClient, resources.NewEmptyFolderTree())
	req.repo = resources.NewDualReadWriter(readWriter, parser, folders, b.access)

	return req, nil
}
