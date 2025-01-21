package unifiedstorage

import (
	"github.com/grafana/grafana/pkg/services/apiserver"
)

type DependencyRegistry interface {
	RegisterRestConfigProvider(restConfigProvider apiserver.RestConfigProvider)
	GetRestConfigProvider() apiserver.RestConfigProvider
}
