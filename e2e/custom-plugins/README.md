# Custom plugins

Plugins in this directory will be installed when the e2e [test server](https://github.com/grafana/grafana/blob/main/scripts/grafana-server/start-server) is started. Optionally, you can provision the plugin by adding configuration to the [datasources.yaml](https://github.com/grafana/grafana/blob/extensions/add-e2e-tests/devenv/datasources.yaml) or to the [plugins.yaml](https://github.com/grafana/grafana/blob/extensions/add-e2e-tests/devenv/plugins.yaml).

These plugins are not being built as part of CI. Plugins in this directory are being version controlled, so make sure the bundle size is small. Only use dependencies provided by the runtime (see list of runtime dependencies [here](https://github.com/grafana/plugin-tools/blob/08b67179bdbf8847788c54aadb22654aa1a7c060/packages/create-plugin/templates/common/.config/webpack/webpack.config.ts#L36)).
