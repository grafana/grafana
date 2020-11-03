+++
title = "Package a plugin"
type = "docs"
aliases = ["/docs/grafana/latest/developers/plugins/share-a-plugin/"]
+++

# Package a plugin

You've just built your first plugin, and now you want to share it with the world. In this guide, you'll learn how to package and share your plugin with others.

When you build a plugin from source, a `dist` directory is created that contains the production build, or _plugin assets_, for your plugin.

When loading your plugin, Grafana only cares about the plugin assets. Specifically, when the Grafana server starts, it attempts to discover and load plugins in the following order:

1. Look for a `plugin.json` file in any of the subdirectories in the plugin directory.
1. If a `plugin.json` was found, try to load the plugin assets from a `dist` directory in the same directory as the `plugin.json` file.
1. If there's no `dist` directory, try to load the plugin assets from the same directory as the `plugin.json` file.

Now that you know what Grafana needs to load your plugin, let's see how to package it.

1. Install dependencies.

   ```
   yarn install --pure-lockfile
   ```

1. Build plugin assets.

   ```
   yarn build
   ```

1. (Optional) If your data source plugin has a backend plugin, build it as well.

   ```
   mage
   ```

1. [Sign the plugin]({{< relref "sign-a-plugin.md" >}}).

1. To create the final package, create a ZIP archive of the `dist` directory.

   ```
   mv dist/ myorg-simple-panel
   zip myorg-simple-panel-1.0.0.zip myorg-simple-panel -r
   ```

## Publish your plugin on Grafana.com

The best way to share your plugin with the world is to publish it on [Grafana Plugins](https://grafana.com/plugins). By having your plugin published on Grafana.com, more users will be able to discover your plugin.

To publish a plugin to [Grafana Plugins](https://grafana.com/grafana/plugins), create a pull request to the [Grafana Plugin Repository](https://github.com/grafana/grafana-plugin-repository). Please note that both the source code and the packaged plugin archive need to be publically available.
