package plugins

import "fmt"

const (
	unsigned ErrorCode = iota
	modified
	invalid
)

type ErrorCode int

func (e ErrorCode) String() string {
	switch e {
	case unsigned:
		return "unsigned"
	case modified:
		return "modified"
	case invalid:
		return "invalid"
	default:
		panic(fmt.Sprintf("Unrecognized error code %d", e))
	}
}

type PluginError struct {
	ErrorCode
}

type PluginErrors struct {
	PluginErrors []PluginError
}
