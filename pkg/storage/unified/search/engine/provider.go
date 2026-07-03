package engine

import (
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// EngineProvider returns a SearchEngine handle for a namespaced resource kind.
type EngineProvider interface {
	For(key resource.NamespacedResource) SearchEngine
}
