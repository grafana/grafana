---
title: Install a plugin
description: Learn about alternative ways to install a plugin.
labels:
  products:
    - enterprise
    - oss
    - cloud
keywords:
  - grafana
  - plugins
  - plugin
  - navigation
  - customize
  - configuration
  - grafana.ini
  - sandbox
  - frontend
weight: 120
---

# Install a plugin

Besides the UI, you can use alternative methods to install a plugin depending on your environment or set-up.

## Install a plugin using Grafana CLI

The Grafana CLI allows you to install, upgrade, and manage your Grafana plugins using a command line tool. For more information about Grafana CLI plugin commands, refer to [Plugin commands](/cli/#plugins-commands).

## Install a plugin from a ZIP file

This method is typically used for plugins not available in the Plugin Catalog or in environments without internet access.

Download the archive containing the plugin assets, and install it by extracting the archive into the plugin directory. For example:

```bash
unzip my-plugin-0.2.0.zip -d YOUR_PLUGIN_DIR/my-plugin
```

The path to the plugin directory is defined in the configuration file. For more information, refer to [Configuration](/setup-grafana/configure-grafana/#plugins).

## Install a plugin using Grafana configuration

{{< admonition type="note" >}}
This feature requires Grafana 11.5.0 or later.
{{< /admonition >}}

You can install plugins by adding the plugin ID to the `plugins.preinstall` section in the Grafana configuration file. This prevents the plugin from being accidentally uninstalled and can be auto-updated. For more information, refer to [Configuration](/setup-grafana/configure-grafana/#plugins).

## Install a plugin in air-gapped environment

Plugin installation usually requires an Internet connection. You can check which endpoints are used during the installation on your instance and add them to your instance’s allow list.

If this is not possible try installing a plugin using the [Grafana CLI](#install-a-plugin-using-grafana-cli) or as a [ZIP file](#install-a-plugin-from-a-zip-file).

You can fetch any plugin from Grafana.com API following the download link referenced in the API.
Here's an example based on `grafana-lokiexplore-app` plugins.

1. Open `https://grafana.com/api/plugins/grafana-lokiexplore-app` and look for `links` section
1. Find a `download` url which looks something like `https://grafana.com/api/plugins/grafana-lokiexplore-app/versions/1.0.2/download`
1. Use this URL to download the plugin ZIP file, which you can then install as described above.

## Install plugins using the Grafana Helm chart

With the Grafana Helm chart, you can install plugins using one of the methods described in this section. All the YAML snippets install v1.9.0 of the Grafana OnCall App plugin and the Redis data source plugin. When installation is complete you'll get a confirmation message indicating that the plugins were successfully installed.

### Method 1: Use the `plugins` field

Add the plugins you want to install as a list in your values file. For more information about the configuration, refer to [the Helm chart configuration reference](https://github.com/grafana/helm-charts/tree/main/charts/grafana#configuration).

```yaml
plugins:
  - https://grafana.com/api/plugins/grafana-oncall-app/versions/v1.9.0/download;grafana-oncall-app
  - redis-datasource
```

### Method 2: Use `GF_PLUGINS_PREINSTALL_SYNC`

Add the following to your `values.yaml` file:

```yaml
env:
  # Format: <plugin ID>@[<plugin version>]@<url to plugin zip>
  GF_PLUGINS_PREINSTALL_SYNC: grafana-oncall-app@1.9.0@https://grafana.com/api/plugins/grafana-oncall-app/versions/v1.9.0/download

  # Or without version and URL (latest version will be used)
  # GF_PLUGINS_PREINSTALL_SYNC: grafana-oncall-app

  # Multiple plugins (comma-separated)
  # GF_PLUGINS_PREINSTALL_SYNC: grafana-oncall-app,redis-datasource
```

### Method 3: Use `GF_PLUGINS_INSTALL` (Deprecated since v12.1.0)

Add the following to your `values.yaml` file:

```yaml
env:
  # Comma-separated list of plugin IDs
  GF_PLUGINS_INSTALL: grafana-oncall-app,redis-datasource
```
