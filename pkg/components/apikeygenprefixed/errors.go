package apikeygenprefix

import "github.com/grafana/grafana/pkg/components/apikeygen"

type ErrInvalidApiKey struct {
}

func (e *ErrInvalidApiKey) Error() string {
	return "invalid API key"
}

func (e *ErrInvalidApiKey) Unwrap() error {
	return apikeygen.ErrInvalidApiKey
}
