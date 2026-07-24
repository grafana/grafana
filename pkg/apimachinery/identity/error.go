package identity

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrInvalidIDType            = errutil.BadRequest("auth.identity.invalid-id-type")
	ErrNotIntIdentifier         = errors.New("identifier is not an int64")
	ErrIdentifierNotInitialized = errors.New("identifier is not initialized")
)
