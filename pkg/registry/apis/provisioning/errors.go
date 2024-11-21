package provisioning

import (
	"errors"
	"io/fs"
)

var (
	ErrFileNotFound      = fs.ErrNotExist
	ErrNamespaceMismatch = errors.New("the file namespace does not match target namespace")
)
