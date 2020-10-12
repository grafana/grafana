package plugins

import "fmt"

const (
	UNSIGNED ErrorCode = iota + 1
	MODIFIED
	INVALID
)

type ErrorCode int

type PluginError struct {
	ErrorCode
	Err error
}

func (e *PluginError) Error() string {
	return fmt.Sprintf("Error (Code: `%d`) in plugin : %v", e.ErrorCode, e.Err)
}

type PluginErrors struct {
	PluginErrors []PluginError
}
