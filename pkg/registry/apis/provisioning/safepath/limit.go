package safepath

import (
	"strings"

	"github.com/pkg/errors"
)

var (
	ErrPathTooLong = errors.New("path too long")
	ErrPathTooDeep = errors.New("path too deep")
)

const (
	MaxPathLength = 1024 // Maximum allowed path length in characters
	MaxNestDepth  = 8    // Maximum allowed directory nesting depth
)

func ValidatePath(path string) error {
	if len(path) > MaxPathLength {
		return ErrPathTooLong
	}

	segments := strings.Split(path, "/")
	if len(segments) > MaxNestDepth {
		return ErrPathTooDeep
	}

	return nil
}
