package pluginerrs

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var _ plugins.ErrorResolver = (*Store)(nil)

type Store struct {
	errs ErrorTracker
}

func ProvideStore(errs ErrorTracker) *Store {
	return &Store{
		errs: errs,
	}
}

func (s *Store) PluginErrors(ctx context.Context) []*plugins.Error {
	errs := s.errs.Errors(ctx)
	for _, err := range errs {
		err.ErrorCode = err.AsErrorCode()
	}

	return errs
}

type ErrorRegistry struct {
	errs map[string]*plugins.Error
	log  log.Logger
}

type ErrorTracker interface {
	Record(ctx context.Context, err *plugins.Error)
	Clear(ctx context.Context, pluginID string)
	Errors(ctx context.Context) []*plugins.Error
}

func ProvideErrorTracker() *ErrorRegistry {
	return newErrorRegistry()
}

func newErrorRegistry() *ErrorRegistry {
	return &ErrorRegistry{
		errs: make(map[string]*plugins.Error),
		log:  log.New("plugins.errors"),
	}
}

func (r *ErrorRegistry) Record(_ context.Context, err *plugins.Error) {
	r.errs[err.PluginID] = err
}

func (r *ErrorRegistry) Clear(_ context.Context, pluginID string) {
	delete(r.errs, pluginID)
}

func (r *ErrorRegistry) Errors(_ context.Context) []*plugins.Error {
	errs := make([]*plugins.Error, 0, len(r.errs))
	for _, err := range r.errs {
		errs = append(errs, err)
	}
	return errs
}
