package signature

type PluginLoaderAuthorizer interface {
	// CanLoadPlugin confirms if a plugin is authorized to load
	CanLoadPlugin(PluginDetails) bool
}

type PluginDetails struct {
	PluginID        string
	SignatureStatus Status
}
