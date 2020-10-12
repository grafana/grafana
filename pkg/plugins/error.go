package plugins

import (
	"errors"
	"fmt"
)

const (
	UNSIGNED ErrorCode = iota
	MODIFIED
	INVALID
)

var (
	ErrPluginIsUnsigned = errors.New("Plugin is unsigned")
)

type ErrorCode int

func (e ErrorCode) String() string {
	return [...]string{"Unsigned", "Modified", "Invalid"}[e]
}

type PluginError struct {
	ErrorCode
	Err error
}

func (e *PluginError) Error() string {
	return fmt.Sprintf("Error (Code: `%d`) in plugin: %v", e.ErrorCode, e.Err)
}

type PluginErrors struct {
	PluginErrors []PluginError
}
