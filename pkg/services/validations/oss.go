package validations

import (
	"net/http"
)

type OSSPluginRequestValidator struct{}

func (*OSSPluginRequestValidator) Init() error {
	return nil
}

func (*OSSPluginRequestValidator) Validate(string, *http.Request) error {
	return nil
}
