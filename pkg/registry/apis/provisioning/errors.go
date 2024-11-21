package provisioning

import "errors"

var (
	ErrFileNotFound      = errors.New("file not found")
	ErrNamespaceMismatch = errors.New("the file namespace does not match target namespace")
)
