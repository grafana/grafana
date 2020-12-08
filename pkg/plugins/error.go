package plugins

const (
	signatureMissing  ErrorCode = "signatureMissing"
	signatureModified ErrorCode = "signatureModified"
	signatureInvalid  ErrorCode = "signatureInvalid"
)

type ErrorCode string

type PluginError struct {
	ErrorCode `json:"errorCode"`
	PluginID  string `json:"pluginId,omitempty"`
}
