package plugins

plugininstall: {
	kind:	   "PluginInstall"
	pluralName: "PluginInstalls"
	current:	"v0alpha1"
	versions: {
    "v0alpha1": {
      codegen: {
        frontend: true
        backend:  true
        options: {
          generateObjectMeta: true
          generateClient:     true
          k8sLike:            true
          package:            "github.com/grafana/grafana/apps/plugins"
        }
      }
      schema: {
        // spec is the schema of our resource
        spec: {
          id:       string
          version:  string
        }
      }
    }
  }
}
