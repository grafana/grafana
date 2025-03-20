package safepath

import (
	"errors"
	"strings"
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

	if strings.Split(path, "/") > MaxNestDepth {
		return ErrPathTooDeep
	}

	return nil
}
