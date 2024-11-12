package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/datasources"
)

type OSSPluginRequestValidator struct{}

func (*OSSPluginRequestValidator) Validate(*datasources.DataSource, *http.Request) error {
	return nil
}

func ProvideValidator() *OSSPluginRequestValidator {
	return &OSSPluginRequestValidator{}
}
