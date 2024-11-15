package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type OSSDataSourceRequestValidator struct{}

func (*OSSDataSourceRequestValidator) Validate(*datasources.DataSource, setting.SecureSocksDSProxySettings, *http.Request) error {
	return nil
}

func ProvideValidator() *OSSDataSourceRequestValidator {
	return &OSSDataSourceRequestValidator{}
}
