package sqleng

import "errors"

var (
	ErrInvalidPortSpecified error = errors.New("invalid port in host specifier")
)
