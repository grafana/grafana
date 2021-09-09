package plugins

type PluginSignatureStatus string

func (pss PluginSignatureStatus) IsValid() bool {
	return pss == PluginSignatureValid
}

func (pss PluginSignatureStatus) IsInternal() bool {
	return pss == PluginSignatureInternal
}

const (
	PluginSignatureInternal PluginSignatureStatus = "internal" // core plugin, no signature
	PluginSignatureValid    PluginSignatureStatus = "valid"    // signed and accurate MANIFEST
	PluginSignatureInvalid  PluginSignatureStatus = "invalid"  // invalid signature
	PluginSignatureModified PluginSignatureStatus = "modified" // valid signature, but content mismatch
	PluginSignatureUnsigned PluginSignatureStatus = "unsigned" // no MANIFEST file
)

type PluginState string

const (
	PluginStateAlpha PluginState = "alpha"
)

type PluginSignatureType string

const (
	GrafanaType PluginSignatureType = "grafana"
	PrivateType PluginSignatureType = "private"
)

type PluginFiles map[string]struct{}

type PluginSignatureState struct {
	Status     PluginSignatureStatus
	Type       PluginSignatureType
	SigningOrg string
	Files      PluginFiles
}
