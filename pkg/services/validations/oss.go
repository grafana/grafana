package validations

import (
	"net/http"
)

type OSSDataSourceRequestValidator struct{}

func (*OSSDataSourceRequestValidator) Validate(string, map[string]any, *http.Request) error {
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
