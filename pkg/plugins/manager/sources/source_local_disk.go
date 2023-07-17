package sources

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type LocalSource struct {
	paths []string
	class plugins.Class
}

func NewLocalSource(class plugins.Class, paths []string) *LocalSource {
	return &LocalSource{
		class: class,
		paths: paths,
	}
}

func (s *LocalSource) PluginClass(_ context.Context) plugins.Class {
	return s.class
}

func (s *LocalSource) PluginURIs(_ context.Context) []string {
	return s.paths
}

func (s *LocalSource) DefaultSignature(_ context.Context) (plugins.Signature, bool) {
	switch s.class {
	case plugins.ClassCore:
		return plugins.Signature{
			Status: plugins.SignatureStatusInternal,
		}, true
	default:
		return plugins.Signature{}, false
	}
}
