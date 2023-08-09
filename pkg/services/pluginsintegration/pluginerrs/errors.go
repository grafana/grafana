package pluginerrs

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var _ plugins.ErrorResolver = (*Store)(nil)

type Store struct {
	signatureErrs SignatureErrorTracker
}

func ProvideStore(signatureErrs SignatureErrorTracker) *Store {
	return &Store{
		signatureErrs: signatureErrs,
	}
}

func (s *Store) PluginErrors() []*plugins.Error {
	sigErrs := s.signatureErrs.SignatureErrors(context.Background())
	errs := make([]*plugins.Error, 0, len(sigErrs))
	for _, err := range sigErrs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}

type SignatureErrorRegistry struct {
	errs map[string]*plugins.SignatureError
	log  log.Logger
}

type SignatureErrorTracker interface {
	Record(ctx context.Context, err *plugins.SignatureError)
	Clear(ctx context.Context, pluginID string)
	SignatureErrors(ctx context.Context) []*plugins.SignatureError
}

func ProvideSignatureErrorTracker() *SignatureErrorRegistry {
	return newSignatureErrorRegistry()
}

func newSignatureErrorRegistry() *SignatureErrorRegistry {
	return &SignatureErrorRegistry{
		errs: make(map[string]*plugins.SignatureError),
		log:  log.New("plugins.errors"),
	}
}

func (r *SignatureErrorRegistry) Record(_ context.Context, signatureErr *plugins.SignatureError) {
	r.errs[signatureErr.PluginID] = signatureErr
}

func (r *SignatureErrorRegistry) Clear(_ context.Context, pluginID string) {
	delete(r.errs, pluginID)
}

func (r *SignatureErrorRegistry) SignatureErrors(_ context.Context) []*plugins.SignatureError {
	errs := make([]*plugins.SignatureError, 0, len(r.errs))
	for _, err := range r.errs {
		errs = append(errs, err)
	}
	return errs
}
