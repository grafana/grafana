package identity

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrInvalidIDType            = errutil.BadRequest("auth.identity.invalid-id-type")
	ErrInvalidTypedID           = errutil.BadRequest("auth.identity.invalid-typed-id")
	ErrNotIntIdentifier         = errors.New("identifier is not an int64")
	ErrIdentifierNotInitialized = errors.New("identifier is not initialized")
)
