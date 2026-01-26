package validations

import (
	"net/http"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type OSSDataSourceRequestValidator struct{}

func (*OSSDataSourceRequestValidator) Validate(string, *simplejson.Json, *http.Request) error {
	return nil
}

func ProvideValidator() *OSSDataSourceRequestValidator {
	return &OSSDataSourceRequestValidator{}
}

type OSSDataSourceRequestURLValidator struct{}

func (*OSSDataSourceRequestURLValidator) Validate(string) error {
	return nil
}

func ProvideURLValidator() *OSSDataSourceRequestURLValidator {
	return &OSSDataSourceRequestURLValidator{}
}
