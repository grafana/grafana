package signature

type PluginLoaderAuthorizer interface {
	// CanLoadPlugin confirms if a plugin is authorized to load
	CanLoadPlugin(Details) bool
}

type Details struct {
	PluginID        string
	SignatureStatus Status
}
