# Plugins App

API documentation is available at http://localhost:3000/swagger?api=plugins.grafana.app-v0alpha1

## Codegen

- Go and TypeScript: `make generate`

## Plugin sync

The plugin sync pushes the plugins loaded from disk to the plugins API.

To enable, add these feature toggles in your `custom.ini`:

```ini
[feature_toggles]
pluginInstallAPISync = true
pluginStoreServiceLoading = true
```
