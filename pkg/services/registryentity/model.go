package registryentity

import "errors"

var ErrTargetSrvConflict = errors.New("target srv conflict")

// TODO figure out if we need a different error format,
// something along the lines of ErrTargetSrvConflict in pkg/services/quota/model.go?
