package registryentity

import "errors"

// TODO figure out if we need a different error format,
// something along the lines of ErrTargetSrvConflict in pkg/services/quota/model.go?
var ErrTargetSrvConflict = errors.New("target srv conflict")
