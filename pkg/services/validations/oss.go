package validations

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type OSSPluginRequestValidator struct{}

func (*OSSPluginRequestValidator) Init() error {
	return nil
}

func (*OSSPluginRequestValidator) Validate(backend.PluginContext, *http.Request) error {
	return nil
}
