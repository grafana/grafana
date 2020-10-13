package plugins

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
}

type PluginErrors struct {
	PluginErrors []PluginError
}
