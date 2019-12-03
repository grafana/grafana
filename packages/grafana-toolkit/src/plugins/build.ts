export interface PluginSourceReference {
  clone: string; // Will be downloaded
  auth?: string; // Auth key to clone?
  branch?: string; // defaults to 'master'
}

export interface PluginBuildManifest {
  // Load the plugin source from an external location
  external: PluginSourceReference[];

  // TODO: bundle information
  // Should be able to load prebuilt executables from grafana API
}
