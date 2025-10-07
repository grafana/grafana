package plugins

pluginInstallV0Alpha1: {
	kind: "PluginInstall"
	plural: "plugininstalls"
	scope: "Namespaced"
	schema: {
		spec: {
			pluginID: string
			version:  string
			source?: {
				type: string | *"catalog" // catalog, cdn, or url
				catalogOptions?: {}
				cdnOptions?: {
					baseURL: string
				}
				urlOptions?: {
					url: string
					checksum?: string
				}
			}
		}
		status: {
			phase?: string // Pending, Installing, Ready, PartiallyFailed, Failed
			message?: string
			nodeStatus?: {[string]: {
				nodeName: string
				phase: string
				installedVersion?: string
				pluginClass?: string
				lastReconciled?: string
				message?: string
			}}
			readyNodes?: int
			installingNodes?: int
			failedNodes?: int
			totalNodes?: int
		}
	}
}
