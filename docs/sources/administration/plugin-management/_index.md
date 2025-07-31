---
aliases:
  - ../plugins/
  - ../plugins/catalog/
  - ../plugins/installation/
  - ../plugins/plugin-signature-verification/
  - ../plugins/plugin-signatures/
labels:
  products:
    - enterprise
    - cloud
    - oss
title: Plugin management
weight: 600
---

# Plugin management

You can enhance your Grafana experience with _plugins_, extensions beyond the wide range of visualizations and data sources that are built-in in Grafana.

This guide gives you an overview so you can get started with plugins:

- There are three [types of plugins](#types-of-plugins): panel, data source, and app plugins.
- Plugins are available in the [plugin catalog](#plugin-catalog). They can be built by Grafana Labs, commercial partners, our community, or you can [build a plugin yourself](/developers/plugin-tools).
- Learn how to [install](#install-a-plugin) and [manage](#manage-your-plugins) your plugins.
- You can also [allow the frontends of installed plugins to communicate locally with the backends](#integrate-plugins) of other installed plugins.

See also the following docs:

- [Customize navigation placement of plugin pages](customize-navigation-placement-of-plugin-pages)
- [Sign in your plugins](plugin-signatures)
- [Plugin Frontend Sandbox](isolate-plugin-code-with-the-plugin-frontend-sandbox)

## Types of plugins

Grafana supports three types of plugins:

- [Panels](/grafana/plugins/panel-plugins) - These plugins make it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards.
- [Data sources](/grafana/plugins/data-source-plugins) - These plugins allow you to pull data from various data sources such as databases, APIs, log files, and so on, and display it in the form of graphs, charts, and dashboards in Grafana.
- [Apps](/grafana/plugins/app-plugins) - These plugins enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

### Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Clock](/grafana/plugins/grafana-clock-panel), [Mosaic](/grafana/plugins/boazreicher-mosaicplot-panel) and [Variable](/grafana/plugins/volkovlabs-variable-panel) panels.

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

### Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](/grafana/plugins/grafana-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to query data from external or third-party systems.

### App plugins

Applications, or _app plugins_, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](/grafana/plugins/alexanderzobnin-zabbix-app) app.

Apps can also add custom pages for things like control panels.

Use app plugins when you want an out-of-the-box monitoring experience.

#### Managing access for app plugins

Customize access to app plugins with [RBAC](../roles-and-permissions/access-control/rbac-for-app-plugins/).

By default, the Viewer, Editor and Admin roles have access to all app plugins that their Organization role allows them to access. Access is granted by the `fixed:plugins.app:reader` role.

{{< admonition type="note" >}}
To prevent users from seeing an app plugin, refer to [these permissions scenarios](../roles-and-permissions/access-control/plan-rbac-rollout-strategy/#prevent-viewers-from-accessing-an-app-plugin).
{{< /admonition >}}

## Plugin catalog

The Grafana plugin catalog allows you to browse and manage plugins from within Grafana. Only Grafana server administrators and Organization administrators can access and use the plugin catalog. For more information about Grafana roles and permissions, refer to [Roles and permissions](../roles-and-permissions/).

The following access rules apply depending on the user role:

- If you are an **Org Admin**, you can configure app plugins, but you can't install, uninstall, or update them.
- If you are a **Server Admin**, you can't configure app plugins, but you can install, uninstall, or update them.
- If you are both **Org Admin** and **Server Admin**, you can configure app plugins and also install, uninstall, or update them.

{{< admonition type="note" >}}
The Grafana plugin catalog is designed to work with a single Grafana server instance only. Support for Grafana clusters is planned for future Grafana releases.
{{< /admonition >}}

<div class="medium-6 columns">
  <video width="700" height="600" controls>
    <source src="/static/assets/videos/plugins-catalog-install-9.2.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

_Video shows the Plugin catalog in a previous version of Grafana._

{{< admonition type="note" >}}
If required, the Grafana plugin catalog can be disabled using the `plugin_admin_enabled` flag in the [configuration](../../setup-grafana/configure-grafana/#plugin_admin_enabled) file.
{{< /admonition >}}

<a id="#plugin-catalog-entry"></a>

### Browse plugins

To browse for available plugins:

1. While logged into Grafana as an administrator, click **Administration > Plugins and data > Plugins** in the side menu to view installed and available plugins.
1. Use the search to filter based on name, keywords, organization and other metadata.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

## Install a plugin

The most common way to install a plugin is through the Grafana UI, but alternative methods are also available.

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Browse and find a plugin.
1. Click the plugin's logo.
1. Click **Install**.

There are also additional ways to install plugins depending on your setup.

### Install a plugin using Grafana CLI

Grafana CLI allows you to install, upgrade, and manage your Grafana plugins using a command line. For more information about Grafana CLI plugin commands, refer to [Plugin commands](../../cli/#plugins-commands).

### Install a plugin from a ZIP file

This method is typically used for plugins not available in the Plugin Catalog or in environments without internet access.

Download the archive containing the plugin assets, and install it by extracting the archive into the plugin directory. For example:

```bash
unzip my-plugin-0.2.0.zip -d YOUR_PLUGIN_DIR/my-plugin
```

The path to the plugin directory is defined in the configuration file. For more information, refer to [Configuration](../../setup-grafana/configure-grafana/#plugins).

### Install a plugin using Grafana configuration

{{< admonition type="note" >}}
This feature requires Grafana 11.5.0 or later.
{{< /admonition >}}

You can install plugins by adding the plugin ID to the `plugins.preinstall` section in the Grafana configuration file. This prevents the plugin from being accidentally uninstalled and can be auto-updated. For more information, refer to [Configuration](../../setup-grafana/configure-grafana/#plugins).

### Install a plugin in air-gapped environment

Plugin installation usually requires an internet connection. You can check which endpoints are used during the installation on your instance and add them to your instance’s allowlist.

If this is not possible you can go via installing a plugin using [Grafana CLI](#install-a-plugin-using-grafana-cli) or as a [ZIP file](#install-a-plugin-from-a-zip-file).

You can fetch any plugin from Grafana.com API following the download link referenced in the API.
Here is an example based on `grafana-lokiexplore-app` plugins.

1. Open `https://grafana.com/api/plugins/grafana-lokiexplore-app` and look for `links` section
1. Find a `download` url which looks something like `https://grafana.com/api/plugins/grafana-lokiexplore-app/versions/1.0.2/download`
1. Use this URL to download the plugin ZIP file, which you can then install as described above.

### Install plugins using the Grafana Helm chart

With the Grafana Helm chart, add the plugins you want to install as a list using the `plugins` field in the your values file. For more information about the configuration, refer to [the Helm chart configuration reference](https://github.com/grafana/helm-charts/tree/main/charts/grafana#configuration).

The following YAML snippet installs v1.9.0 of the Grafana OnCall App plugin and the Redis data source plugin.
You must incorporate this snippet within your Helm values file.

```yaml
plugins:
  - https://grafana.com/api/plugins/grafana-oncall-app/versions/v1.9.0/download;grafana-oncall-app
  - redis-datasource
```

When the update is complete, a confirmation message will indicate the installation was successful.

## Manage your plugins

### Update a plugin

To update a plugin:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Click the **Installed** filter to show only installed plugins.
1. Click the plugin's logo.
1. Click **Update**.

When the update is complete, a confirmation message will indicate the installation was successful.

### Uninstall a plugin

To uninstall a plugin:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Click the plugin's logo.
1. Click the **Installed** filter to show only installed plugins.
1. Click **Uninstall**.

When the update is complete, a confirmation message will indicate the installation was successful.

## Integrate plugins

You can configure your Grafana instance to let the frontends of installed plugins directly communicate locally with the backends of other installed plugins. By default, you can only communicate with plugin backends remotely. You can use this configuration to, for example, enable a [canvas panel](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/canvas/) to call an application resource API that is permitted by the `actions_allow_post_url` option.

To enable backend communication between plugins:

1. Set the plugins you want to communicate with. In your configuration file (`grafana.ini` or `custom.ini` depending on your operating system) remove the semicolon to enable and then set the following configuration option:

   ```
   actions_allow_post_url=
   ```

   This is a comma-separated list that uses glob matching.
   - To allow access to all plugins that have a backend:

     ```
     actions_allow_post_url=/api/plugins/*
     ```

   - To access to the backend of only one plugin:

     ```
     actions_allow_post_url=/api/plugins/<GRAFANA_SPECIAL_APP>
     ```

## Learn more

- [Browse available plugins](/grafana/plugins)
- [Develop your own plugins](/developers/plugin-tools)
- [Reach out to the plugin development Community](https://community.grafana.com/c/plugin-development/30)
