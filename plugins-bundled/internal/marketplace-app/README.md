# Marketplace for Grafana

[![Build](https://github.com/grafana/marketplace-app/workflows/CI/badge.svg)](https://github.com/grafana/marketplace-app/actions?query=workflow%3A%22CI%22)
[![Release](https://github.com/grafana/marketplace-app/workflows/Release/badge.svg)](https://github.com/grafana/marketplace-app/actions?query=workflow%3ARelease)
[![License](https://img.shields.io/github/license/grafana/marketplace-app)](LICENSE)

Browse and manage plugins from within Grafana.

- Anyone can browse plugins and list installed plugins
- Only Admin users are allowed to install and uninstall plugins

**IMPORTANT:** This plugin is **NOT** production-ready. Use it at your own risk.

![Screenshot](https://github.com/grafana/marketplace-app/raw/master/src/img/discover.png)

## Installation

Marketplace hasn't yet been published to [grafana.com](https://grafana.com/plugins), but you can install it using [grafana-cli](https://grafana.com/docs/grafana/latest/administration/cli/#grafana-cli):

1. Install the plugin using [grafana-cli](https://grafana.com/docs/grafana/latest/administration/cli/#grafana-cli):

   ```
   grafana-cli --pluginUrl=https://github.com/grafana/marketplace-app/releases/download/v0.4.0/grafana-marketplace-app-0.4.0.zip plugins install grafana-marketplace-app
   ```

1. Restart the Grafana server
1. Navigate to **Configuration** -> **Plugins** and click on the Marketplace plugin in the list
1. Click the **Enable app** to enable the plugin
1. Click the **Pin app** to add it to the side menu
1. Configure the directory where you want to install your plugins, e.g. `/var/lib/grafana/plugins`

## Configuration

| Option | Description |
|--------|-------------|
| _Enable app_ | Must be done before being able to use the plugin |
| _Pin app_ | Add the app to the side menu |
| _Show Enterprise plugins_ | Show Enterprise plugins in the marketplace |
| _Show unsigned plugins_ | Show unsigned plugins in the marketplace |
| _Plugin directory_ | Directory where plugins should be installed to |
