package identity

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInvalidNamepsaceID       = errutil.BadRequest("auth.identity.invalid-namespace-id")
	ErrNotIntIdentifier         = errors.New("identifier is not an int64")
	ErrIdentifierNotInitialized = errors.New("identifier is not initialized")
)
