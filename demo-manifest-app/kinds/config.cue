package kinds

// config holds the grafana-app-sdk code generation settings, and is read by
// `grafana-app-sdk generate` (via the default `-c config` selector) when you run
// `npm run generate:kinds`.
//
// Paths are relative to the plugin root and match the layout scaffolded by @grafana/create-plugin:
// the frontend lives in src/.
config: {
	definitions: {
		manifestVersion:  "v1alpha2"

		// Do not edit this section; the generated manifest must be named exactly as below.
		// The manifest tells Grafana which kinds and capabilities your app serves. Write it
		// straight into src/ so the frontend build picks it up as-is.
		manifestSchemas:  true
		path:             "src"
		manifestFileName: "app-sdk-manifest.json"
		encoding:         "json"
		// Do not generate separate files per-CRD, they are not used.
		genCRDs: false
	}

	codegen: {
		// Generated Go types land alongside the plugin backend.
		goEnabled: true
		goGenPath: "pkg/generated/"
		// Generated TypeScript types land in the frontend source dir.
		tsGenPath:                      "src/generated/"
		enableK8sPostProcessing:        false
		enableOperatorStatusGeneration: false
	}
}
