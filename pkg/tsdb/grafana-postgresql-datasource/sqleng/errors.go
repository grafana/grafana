package sqleng

import "errors"

var (
	ErrParsingPostgresURL error = errors.New("error parsing postgres url")
	ErrCertFileNotExist   error = errors.New("certificate file doesn't exist")
)
