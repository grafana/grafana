---
aliases:
  - /docs/grafana/latest/plugins/
  - /docs/grafana/latest/plugins/catalog/
  - /docs/grafana/latest/plugins/installation/
  - /docs/grafana/latest/plugins/plugin-signature-verification/
  - /docs/grafana/latest/plugins/plugin-signatures/
title: Plugin management
weight: 600
---

# Plugin management

Besides the wide range of visualizations and data sources that are available immediately after you install Grafana, you can extend your Grafana experience with _plugins_.

You can [install]({{< ref "#install-a-plugin" >}}) one of the plugins built by the Grafana community, or [build one yourself]({{< relref "../../developers/plugins/" >}}).

Grafana supports three types of plugins: [panels](https://grafana.com/grafana/plugins?type=panel), [data sources](https://grafana.com/grafana/plugins?type=datasource), and [apps](https://grafana.com/grafana/plugins?type=app).

## Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel), [Clock](https://grafana.com/grafana/plugins/grafana-clock-panel), and [Pie Chart](https://grafana.com/grafana/plugins/grafana-piechart-panel).

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

## Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](https://grafana.com/grafana/plugins/doitintl-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to import data from external systems.

## App plugins

Applications, or _app plugins_, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](https://grafana.com/grafana/plugins/alexanderzobnin-zabbix-app) app.

Apps can also add custom pages for things like control panels.

Use app plugins when you want to create an custom out-of-the-box monitoring experience.

## Plugin catalog

The Plugin catalog allows you to browse and manage plugins from within Grafana. Only Grafana server administrators and organization administrators can access and use the plugin catalog. The following access rules apply depending on the user role:

| Org Admin | Server Admin | Permissions                                                                                 |
| --------- | ------------ | ------------------------------------------------------------------------------------------- |
| &check;   | &check;      | <ul><li>Can configure app plugins</li><li>Can install/uninstall/update plugins</li></ul>    |
| &check;   | &times;      | <ul><li>Can configure app plugins</li><li>Cannot install/uninstall/update plugins</li></ul> |
| &times;   | &check;      | <ul><li>Cannot configure app plugins</li><li>Can install/uninstall/update plugins</li></ul> |

> **Note:** The Plugin catalog is designed to work with a single Grafana server instance only. Support for Grafana clusters will be added in future Grafana releases.

<div class="medium-6 columns">
  <video width="700" height="600" controls>
    <source src="/static/assets/videos/plugins-catalog-install-8-1.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

In order to be able to install / uninstall / update plugins using plugin catalog, you must enable it via the `plugin_admin_enabled` flag in the [configuration]({{< relref "../../setup-grafana/configure-grafana/#plugin_admin_enabled" >}}) file.
Before following the steps below, make sure you are logged in as a Grafana administrator.

<a id="#plugin-catalog-entry"></a>
Currently, there are two entry points to the Plugin catalog.

- Grafana server administrators can find it at **Server Admin >
  Plugins**.
- Organization administrators can find it at **Configuration > Plugins**.

### Browse plugins

To browse for available plugins:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click the **All** filter to browse all available plugins.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

![Plugin catalog browse](/static/img/docs/plugins/plugins-catalog-browse-8-1.png)

### Install a plugin

To install a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Browse and find a plugin.
1. Click on the plugin logo.
1. Click **Install**.

When the update is complete, you see a confirmation message that the installation was successful.

![Plugin catalog install](/static/img/docs/plugins/plugins-catalog-install-8-1.png)

### Update a plugin

To update a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click on the plugin logo.
1. Click **Update**.

When the update is complete, you see a confirmation message that the update was successful.

![Plugin catalog update](/static/img/docs/plugins/plugins-catalog-update-8-1.png)

### Uninstall a plugin

To uninstall a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click on the plugin logo.
1. Click **Uninstall**.

When the update is complete, you see a confirmation message that the uninstall was successful.

![Plugin catalog uninstall](/static/img/docs/plugins/plugins-catalog-uninstall-8-1.png)

## Install Grafana plugins

Grafana supports data source, panel, and app plugins. Having panels as plugins makes it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards. Apps enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

1. In a web browser, navigate to the official [Grafana Plugins page](https://grafana.com/plugins) and find a plugin that you want to install.
1. Click the plugin, and then click the **Installation** tab.

### Install plugin on Grafana Cloud

On the Installation tab, in the **For** field, click the name of the Grafana instance that you want to install the plugin on.

Grafana Cloud handles the plugin installation automatically.

If you are logged in to Grafana Cloud when you add a plugin, log out and back in again to use the new plugin.

### Install plugin on local Grafana

Follow the instructions on the Install tab. You can either install the plugin with a Grafana CLI command or by downloading and uncompress a .zip file into the Grafana plugins directory. We recommend using Grafana CLI in most instances. The .zip option is available if your Grafana server does not have access to the internet.

For more information about Grafana CLI plugin commands, refer to [Plugin commands]({{< relref "../../cli/#plugins-commands" >}}).

As of Grafana v8.0, a plugin catalog app was introduced in order to make managing plugins easier. For more information, refer to [Plugin catalog]({{< ref "#plugin-catalog" >}}).

#### Install a packaged plugin

After the user has downloaded the archive containing the plugin assets, they can install it by extracting the archive into their plugin directory.

```
unzip my-plugin-0.2.0.zip -d YOUR_PLUGIN_DIR/my-plugin
```

The path to the plugin directory is defined in the configuration file. For more information, refer to [Configuration]({{< relref "../../setup-grafana/configure-grafana/#plugins" >}}).

## Plugin signatures

Plugin signature verification (signing) is a security measure to make sure plugins haven't been tampered with. Upon loading, Grafana checks to see if a plugin is signed or unsigned when inspecting and verifying its digital signature.

At startup, Grafana verifies the signatures of every plugin in the plugin directory. If a plugin is unsigned, then Grafana does not load nor start it. To see the result of this verification for each plugin, navigate to **Configuration** -> **Plugins**.

Grafana also writes an error message to the server log:

```bash
WARN[05-26|12:00:00] Some plugin scanning errors were found   errors="plugin '<plugin id>' is unsigned, plugin '<plugin id>' has an invalid signature"
```

If you are a plugin developer and want to know how to sign your plugin, refer to [Sign a plugin]({{< relref "../../developers/plugins/sign-a-plugin/" >}}).

| Signature status   | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| Core               | Core plugin built into Grafana.                                                 |
| Invalid signature  | The plugin has a invalid signature.                                             |
| Modified signature | The plugin has changed since it was signed. This may indicate malicious intent. |
| Unsigned           | The plugin is not signed.                                                       |
| Signed             | The plugin signature was successfully verified.                                 |

### Plugin signature levels

All plugins is signed under a _signature level_. The signature level determines how the plugin can be distributed.

| **Plugin Level** | **Description**                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Private          | <p>Private plugins are for use on your own Grafana. They may not be distributed to the Grafana community, and are not published in the Grafana catalog.</p>                                                              |
| Community        | <p>Community plugins have dependent technologies that are open source and not for profit.</p><p>Community plugins are published in the official Grafana catalog, and are available to the Grafana community.</p>         |
| Commercial       | <p>Commercial plugins have dependent technologies that are closed source or commercially backed.</p><p>Commercial Plugins are published on the official Grafana catalog, and are available to the Grafana community.</p> |

### Allow unsigned plugins

> **Note:** Unsigned plugins are not supported in Grafana Cloud.

We strongly recommend that you don't run unsigned plugins in your Grafana instance. If you're aware of the risks and you still want to load an unsigned plugin, refer to [Configuration]({{< relref "../../setup-grafana/configure-grafana/#allow_loading_unsigned_plugins" >}}).

If you've allowed loading of an unsigned plugin, then Grafana writes a warning message to the server log:

```bash
WARN[06-01|16:45:59] Running an unsigned plugin   pluginID=<plugin id>
```

> **Note:** If you're developing a plugin, then you can enable development mode to allow all unsigned plugins.

## Learn more

- Browse the available [Plugins](https://grafana.com/grafana/plugins)
