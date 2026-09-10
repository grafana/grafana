//go:build !enterprise && !pro

package server

import "github.com/grafana/grafana/pkg/router"

func (s *ModuleServer) provideRoutesLoader() (router.RoutesLoader, error) {
	return InitializeRoutesLoader(s.context, s.cfg, s.opts, s.apiOpts)
}
