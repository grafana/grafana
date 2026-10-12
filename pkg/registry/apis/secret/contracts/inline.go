package contracts

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue"
)

var (
	ErrInlineSecureValueNoAuth          = fmt.Errorf("missing auth info in context for inline secure value operation")
	ErrInlineSecureValueInvalidName     = fmt.Errorf("invalid secure value name")
	ErrInlineSecureValueInvalidOwner    = fmt.Errorf("owner reference must have a valid API group, API version, kind and name ")
	ErrInlineSecureValueMismatchOwner   = fmt.Errorf("owner mismatch")
	ErrInlineSecureValueNotFound        = fmt.Errorf("secure value not found")
	ErrInlineSecureValueInvalidIdentity = fmt.Errorf("invalid identity")
	ErrInlineSecureValueCannotReference = fmt.Errorf("secure value cannot be referenced by the owner")
)

// The interface lives with apistore, which calls it, so the apistore module does not depend on core.
type InlineSecureValueSupport = securevalue.InlineSecureValueSupport
