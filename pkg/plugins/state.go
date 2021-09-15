package plugins

type SignatureStatus string

func (ss SignatureStatus) IsValid() bool {
	return ss == SignatureValid
}

func (ss SignatureStatus) IsInternal() bool {
	return ss == SignatureInternal
}

const (
	SignatureInternal SignatureStatus = "internal" // core plugin, no signature
	SignatureValid    SignatureStatus = "valid"    // signed and accurate MANIFEST
	SignatureInvalid  SignatureStatus = "invalid"  // invalid signature
	SignatureModified SignatureStatus = "modified" // valid signature, but content mismatch
	SignatureUnsigned SignatureStatus = "unsigned" // no MANIFEST file
)

type State string

const (
	StateAlpha State = "alpha"
)

type SignatureType string

const (
	GrafanaType SignatureType = "grafana"
	PrivateType SignatureType = "private"
)

type PluginFiles map[string]struct{}

type Signature struct {
	Status     SignatureStatus
	Type       SignatureType
	SigningOrg string
	Files      PluginFiles
}

type SignatureError struct {
	PluginID string          `json:"pluginId"`
	Status   SignatureStatus `json:"status"`
}
