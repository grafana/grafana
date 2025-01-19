package unifiedstorage

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type UnifiedStorageClientRegistrar interface {
	RegisterClient(c resource.ResourceClient)
	GetClient() resource.ResourceClient
}

type GetClient func() resource.ResourceClient
