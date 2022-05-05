package validations

import (
	"net/http"
)

type OSSPluginRequestValidator struct{}

func (*OSSPluginRequestValidator) Validate(string, *http.Request) error {
	return nil
}

func ProvideValidator() *OSSPluginRequestValidator {
	return &OSSPluginRequestValidator{}
}
