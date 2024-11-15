package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type OSSPluginRequestValidator struct{}

func (*OSSPluginRequestValidator) Validate(*datasources.DataSource, setting.SecureSocksDSProxySettings, *http.Request) error {
	return nil
}

func ProvideValidator() *OSSPluginRequestValidator {
	return &OSSPluginRequestValidator{}
}
