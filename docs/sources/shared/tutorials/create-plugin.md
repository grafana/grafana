---
title: Create Plugin
---

Tooling for modern web development can be tricky to wrap your head around. While you certainly can write your own webpack configuration, for this guide, you'll be using grafana create-plugin tool

Grafana [create-plugin tool](https://www.npmjs.com/package/@grafana/create-plugin) is a CLI application that simplifies Grafana plugin development, so that you can focus on code. The tool scaffolds a starter plugin and all the required configuration for you.

1. In the plugin directory, create a plugin from template using create-plugin. When prompted for the kind of plugin, select `datasource`:

   ```
   npx @grafana/create-plugin@latest
   ```

1. Change directory to your newly created plugin:

   ```
   cd my-plugin
   ```

1. Install the dependencies:

   ```
   yarn install
   ```

1. Build the plugin:

   ```
   yarn dev
   ```

1. Restart the Grafana server for Grafana to discover your plugin.
1. Open Grafana and go to **Configuration** -> **Plugins**. Make sure that your plugin is there.

By default, Grafana logs whenever it discovers a plugin:

```
INFO[01-01|12:00:00] Registering plugin       logger=plugins name=my-plugin
```
