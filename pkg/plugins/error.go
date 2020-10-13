package plugins

import (
	"fmt"
)

const (
	UNSIGNED ErrorCode = iota
	MODIFIED
	INVALID
)

type ErrorCode int

func (e ErrorCode) String() string {
	return [...]string{"unsigned", "modified", "invalid"}[e]
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
