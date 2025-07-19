package secret

import "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"

var (
	ErrSecureValueNotFound      = contracts.ErrSecureValueNotFound
	ErrSecureValueAlreadyExists = contracts.ErrSecureValueAlreadyExists
)
