package plugins

type ErrorCode string

type PluginError struct {
	ErrorCode `json:"errorCode"`
	PluginID  string `json:"pluginId,omitempty"`
}
