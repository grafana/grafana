package kinds

// kindKind is a kind that declares another kind: one in a namespaced API group of this app,
// <apiGroup>.<namespace>.demomanifestapp.ext.grafana.app. The app's _manifests route lists one
// manifest per namespace and apiGroup, with a kind for each Kind object that names them.
kindKind: {
	kind:       "Kind"
	pluralName: "Kinds"
	scope:      "Namespaced"
	// Not folder-scoped, so the demo needs no folder.
	folderScoped: false
	codegen: {
		ts: {
			enabled: true
		}
		// A kind named Kind generates a Go type and a func both named Kind;
		// .config/app-sdk/rename-kind-func.mjs renames the func after generation.
		go: {
			enabled: true
		}
	}
}

kindv1alpha1: kindKind & {
	schema: {
		spec: {
			// apiGroup is the first label of the declared kind's group. It must be a DNS label.
			apiGroup: string & =~"^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$"
			// name is the declared kind's name, such as Widget.
			name: string & =~"^[A-Z][a-zA-Z0-9]{0,62}$"
		}
	}
}
