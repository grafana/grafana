package errors

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
)

var _ plugins.ErrorResolver = (*Resolver)(nil)

type Resolver struct {
	signatureValidator signature.Validator
	pluginRegistry     registry.Service
	log                log.Logger
}

func ProvideService(signatureValidator signature.Validator, pluginRegistry registry.Service) *Resolver {
	return newResolver(signatureValidator, pluginRegistry)
}

func newResolver(signatureValidator signature.Validator, pluginRegistry registry.Service) *Resolver {
	return &Resolver{
		signatureValidator: signatureValidator,
		pluginRegistry:     pluginRegistry,
		log:                log.New("plugins.errors"),
	}
}

func (r *Resolver) PluginErrors() []*plugins.Error {
	signatureErrs := r.signatureValidationErrors(context.Background())
	errs := make([]*plugins.Error, 0, len(signatureErrs))
	for _, err := range signatureErrs {
		errs = append(errs, &plugins.Error{
			PluginID:  err.PluginID,
			ErrorCode: err.AsErrorCode(),
		})
	}

	return errs
}

func (r *Resolver) signatureValidationErrors(ctx context.Context) []*plugins.SignatureError {
	var errs []*plugins.SignatureError
	for _, p := range r.pluginRegistry.Plugins(ctx) {
		err := r.signatureValidator.ValidateSignature(p)
		errs = append(errs, err)
	}
	return errs
}
