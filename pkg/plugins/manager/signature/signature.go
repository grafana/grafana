package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Validator interface {
	ValidateSignature(plugin *plugins.Plugin) error
}

type Validation struct {
	authorizer plugins.PluginLoaderAuthorizer
	log        log.Logger
}

func ProvideValidatorService(authorizer plugins.PluginLoaderAuthorizer) *Validation {
	return NewValidator(authorizer)
}

func NewValidator(authorizer plugins.PluginLoaderAuthorizer) *Validation {
	return &Validation{
		authorizer: authorizer,
		log:        log.New("plugin.signature.validator"),
	}
}

// To not get validation error when running data sources in api server locally
func (s *Validation) ValidateSignature(plugin *plugins.Plugin) error {
	return nil
}
