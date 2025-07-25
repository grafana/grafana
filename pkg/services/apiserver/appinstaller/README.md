# AppInstaller

An `AppInstaller` (`appsdkapiserver.AppInstaller`) is a new concept introduced in v0.40.0 of the Grafana App SDK. It is an interface responsible for installing an app into the Grafana API server. Each app provides an `AppInstaller` implementation, which is then used by the API server to manage the app.

## Architectural Changes

### New App Installer Framework

A new framework for installing and managing apps has been introduced in `pkg/services/apiserver/appinstaller`. This framework is responsible for:

-   **Schema Registration:** Registering the Kubernetes-style API schemas defined by an app.
-   **Admission Plugins:** Registering admission plugins for apps.
-   **OpenAPI Definitions:** Aggregating OpenAPI definitions from all installed apps.
-   **API Installation:** Installing the API groups and resources defined by an app.
-   **Lifecycle Management:** Managing the lifecycle of an app, including initialization and startup.

### API Server Integration

Grafana's core API server (`pkg/services/apiserver/service.go`) has been significantly updated to integrate with the new app installer framework. During startup, the API server now performs the following steps:

1.  Collects all `AppInstaller` instances provided by the apps.
2.  Uses the `appinstaller` framework to register schemas, admission plugins, and OpenAPI definitions.
3.  Installs the APIs for each app.
4.  Initializes and starts each app.

This ensures that apps are seamlessly integrated into Grafana's API server and that their resources are available through the Grafana API.

### App Registration

The method for registering apps has been updated:

-   The old way of registering apps using `ProvideBuilderRunners` in `pkg/registry/apps/apps.go` is now deprecated.
-   The new, preferred way is to use the `ProvideAppInstallers` function, which returns a list of `AppInstaller` instances.

This change streamlines the app registration process and makes it more consistent.

## Migration Guide

To migrate an existing app to the new SDK, you need to:

1.  Implement the `appsdkapiserver.AppInstaller` interface for your app.
2.  Update your app's registration to use the `ProvideAppInstallers` function.

### Example: Playlist App

The Playlist app has been migrated to the new App SDK. Let's look at how it was done.

Previously, the Playlist app was registered using `ProvideBuilderRunners`:

```go
// pkg/registry/apps/apps.go (before)
func ProvideBuilderRunners(
    // ...
    playlistAppProvider *playlist.PlaylistAppProvider,
    // ...
) (*Service, error) {
    // ...
    providers := []app.Provider{playlistAppProvider}
    // ...
}
```

Now, the Playlist app provides an `AppInstaller` and is registered through `ProvideAppInstallers`:

```go
// pkg/registry/apps/apps.go (after)
func ProvideAppInstallers(
	playlistAppInstaller *playlist.PlaylistAppInstaller,
) []appsdkapiserver.AppInstaller {
	return []appsdkapiserver.AppInstaller{playlistAppInstaller}
}
```

The implementation of the `PlaylistAppInstaller` can be found in `pkg/registry/apps/playlist/register.go`. This file is a good reference for how to implement an `AppInstaller` for your own app.

The `pkg/registry/apps/playlist/register.go` file does the following:
- It defines `PlaylistAppInstaller`, which embeds `appsdkapiserver.AppInstaller`.
- It implements `appinstaller.LegacyStorageProvider` to bridge with Grafana's existing playlist service.
- The `RegisterAppInstaller` function initializes the installer, providing the app's manifest, specific configuration, and associating Go types with API kinds.
- It shows how to provide a custom table converter for `kubectl get` style output. 