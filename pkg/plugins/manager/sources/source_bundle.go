package sources

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

// BundleSource is a fake source that contains only a single bundle.
// This allows loading individual bundles without reloading entire sources.
type BundleSource struct {
	bundle         *plugins.FoundBundle
	pluginClass    plugins.Class
	originalSource plugins.PluginSource
}

// NewBundleSource creates a fake source containing only the specified bundle.
func NewBundleSource(bundle *plugins.FoundBundle, originalSource plugins.PluginSource) *BundleSource {
	return &BundleSource{
		bundle:         bundle,
		originalSource: originalSource,
	}
}

func (s *BundleSource) PluginClass(ctx context.Context) plugins.Class {
	return s.originalSource.PluginClass(ctx)
}

func (s *BundleSource) DefaultSignature(ctx context.Context, pluginID string) (plugins.Signature, bool) {
	if pluginID == s.bundle.Primary.JSONData.ID {
		return s.originalSource.DefaultSignature(ctx, pluginID)
	}
	return plugins.Signature{}, false
}

func (s *BundleSource) Discover(_ context.Context) ([]*plugins.FoundBundle, error) {
	return []*plugins.FoundBundle{s.bundle}, nil
}
