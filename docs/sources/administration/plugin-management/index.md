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

You can enhance your Grafana experience with _plugins_, extensions to Grafana beyond the wide range of visualizations and data sources that are built-in.

This guide shows you how to [install](#install-a-plugin) plugins that are built by Grafana Labs, commercial partners, our community, or plugins that you have [built yourself](/developers/plugin-tools).

## Types of plugins

Grafana supports three types of plugins:

- [Panels](/grafana/plugins/panel-plugins) - These plugins make it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards.
- [Data sources](/grafana/plugins/data-source-plugins) - These plugins allow you to pull data from various data sources such as databases, APIs, log files, and so on, and display it in the form of graphs, charts, and dashboards in Grafana.
- [Apps](/grafana/plugins/app-plugins) - These plugins enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

## Panel plugins

Add new visualizations to your dashboard with panel plugins, such as the [Clock](/grafana/plugins/grafana-clock-panel), [Mosaic](/grafana/plugins/boazreicher-mosaicplot-panel) and [Variable](/grafana/plugins/volkovlabs-variable-panel) panels.

Use panel plugins when you want to:

- Visualize data returned by data source queries.
- Navigate between dashboards.
- Control external systems, such as smart home devices.

## Data source plugins

Data source plugins add support for new databases, such as [Google BigQuery](/grafana/plugins/grafana-bigquery-datasource).

Data source plugins communicate with external sources of data and return the data in a format that Grafana understands. By adding a data source plugin, you can immediately use the data in any of your existing dashboards.

Use data source plugins when you want to query data from external or third-party systems.

## App plugins

Applications, or _app plugins_, bundle data sources and panels to provide a cohesive experience, such as the [Zabbix](/grafana/plugins/alexanderzobnin-zabbix-app) app.

Apps can also add custom pages for things like control panels.

Use app plugins when you want an out-of-the-box monitoring experience.

### Managing access for app plugins

Customize access to app plugins with [RBAC]({{< relref "../roles-and-permissions/access-control/#about-rbac" >}}).

By default, the Viewer, Editor and Admin roles have access to all app plugins that their Organization role allows them to access. Access is granted by the `fixed:plugins.app:reader` role.

{{% admonition type="note" %}}
To prevent users from seeing an app plugin, refer to [these permissions scenarios]({{< relref "../roles-and-permissions/access-control/plan-rbac-rollout-strategy#prevent-viewers-from-accessing-an-app-plugin" >}}).
{{% /admonition %}}

## Plugin catalog

The Grafana plugin catalog allows you to browse and manage plugins from within Grafana. Only Grafana server administrators and Organization administrators can access and use the plugin catalog. For more information about Grafana roles and permissions, refer to [Roles and permissions]({{< relref "../administration/roles-and-permissions" >}}).

The following access rules apply depending on the user role:

- If you are an **Org Admin**, you can configure app plugins, but you can't install, uninstall, or update them.
- If you are a **Server Admin**, you can't configure app plugins, but you can install, uninstall, or update them.
- If you are both **Org Admin** and **Server Admin**, you can configure app plugins and also install, uninstall, or update them.

{{% admonition type="note" %}}
The Grafana plugin catalog is designed to work with a single Grafana server instance only. Support for Grafana clusters is planned for future Grafana releases.
{{% /admonition %}}

<div class="medium-6 columns">
  <video width="700" height="600" controls>
    <source src="/static/assets/videos/plugins-catalog-install-9.2.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

_Video shows the Plugin catalog in a previous version of Grafana._

{{% admonition type="note" %}}
If required, the Grafana plugin catalog can be disabled using the `plugin_admin_enabled` flag in the [configuration]({{< relref "../../setup-grafana/configure-grafana/#plugin_admin_enabled" >}}) file.
{{% /admonition %}}

<a id="#plugin-catalog-entry"></a>

### Browse plugins

To browse for available plugins:

1. While logged into Grafana as an administrator, click **Administration > Plugins and data > Plugins** in the side menu to view installed and available plugins.
1. Use the search to filter based on name, keywords, organization and other metadata.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

### Install a plugin

To install a plugin:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Browse and find a plugin.
1. Click the plugin's logo.
1. Click **Install**.

When the update is complete, you'll see a confirmation message that the installation was successful.

### Update a plugin

To update a plugin:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Click the **Installed** filter to show only installed plugins.
1. Click the plugin's logo.
1. Click **Update**.

When the update is complete, you'll see a confirmation message that the update was successful.

### Uninstall a plugin

To uninstall a plugin:

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Click the plugin's logo.
1. Click the **Installed** filter to show only installed plugins.
1. Click **Uninstall**.

When the update is complete, you'll see a confirmation message that the uninstall was successful.

## Install Grafana plugins

Grafana supports data source, panel, and app plugins.

1. In a web browser, navigate to the [Grafana plugin catalog](https://grafana.com/plugins) and find a plugin that you want to install.
1. Click the plugin, and then click the **Installation** tab.

### Install plugin on Grafana Cloud

On the **Installation tab**, in the **For** field, click the name of the Grafana instance on which you want to install the plugin.

Grafana Cloud handles the plugin installation automatically.

If you're logged in to Grafana Cloud when you add a plugin, log out and then log back in again to use the new plugin.

### Install plugin on local Grafana

Follow the instructions on the **Install** tab. You can either install the plugin with a Grafana CLI command or by downloading and uncompressing a zip file into the Grafana plugins directory. We recommend using Grafana CLI in most instances. The zip option is available if your Grafana server doesn't have access to the internet.

For more information about Grafana CLI plugin commands, refer to [Plugin commands]({{< relref "../../cli/#plugins-commands" >}}).

#### Install a packaged plugin

After the user has downloaded the archive containing the plugin assets, they can install it by extracting the archive into their plugin directory. For example:

```bash
unzip my-plugin-0.2.0.zip -d YOUR_PLUGIN_DIR/my-plugin
```

The path to the plugin directory is defined in the configuration file. For more information, refer to [Configuration]({{< relref "../../setup-grafana/configure-grafana/#plugins" >}}).

## Plugin signatures

Plugin signature verification, also known as _signing_, is a security measure to make sure plugins haven't been tampered with. Upon loading, Grafana checks to see if a plugin is signed or unsigned when inspecting and verifying its digital signature.

At startup, Grafana verifies the signatures of every plugin in the plugin directory. If a plugin is unsigned, then Grafana neither loads nor starts it. To see the result of this verification for each plugin, navigate to **Configuration** -> **Plugins**.

Grafana also writes an error message to the server log:

```bash
WARN[05-26|12:00:00] Some plugin scanning errors were found   errors="plugin '<plugin id>' is unsigned, plugin '<plugin id>' has an invalid signature"
```

If you are a plugin developer and want to know how to sign your plugin, refer to [Sign a plugin](/developers/plugin-tools/publish-a-plugin/sign-a-plugin).

| Signature status   | Description                                                                     |
| ------------------ | ------------------------------------------------------------------------------- |
| Core               | Core plugin built into Grafana.                                                 |
| Invalid signature  | The plugin has an invalid signature.                                            |
| Modified signature | The plugin has changed since it was signed. This may indicate malicious intent. |
| Unsigned           | The plugin is not signed.                                                       |
| Signed             | The plugin signature was successfully verified.                                 |

### Plugin signature levels

All plugins are signed under a _signature level_. The signature level determines how the plugin can be distributed.

| **Plugin Level** | **Description**                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Private          | <p>Private plugins are for use on your own Grafana. They may not be distributed to the Grafana community, and are not published in the Grafana catalog.</p>                                                              |
| Community        | <p>Community plugins have dependent technologies that are open source and not for profit.</p><p>Community plugins are published in the official Grafana catalog, and are available to the Grafana community.</p>         |
| Commercial       | <p>Commercial plugins have dependent technologies that are closed source or commercially backed.</p><p>Commercial plugins are published on the official Grafana catalog, and are available to the Grafana community.</p> |

### Allow unsigned plugins

{{% admonition type="note" %}}
Unsigned plugins are not supported in Grafana Cloud.
{{% /admonition %}}

We strongly recommend that you don't run unsigned plugins in your Grafana instance. However, if you're aware of the risks and you still want to load an unsigned plugin, refer to [Configuration]({{< relref "../../setup-grafana/configure-grafana/#allow_loading_unsigned_plugins" >}}).

If you've allowed loading of an unsigned plugin, then Grafana writes a warning message to the server log:

```bash
WARN[06-01|16:45:59] Running an unsigned plugin   pluginID=<plugin id>
```

{{% admonition type="note" %}}
If you're developing a plugin, then you can enable development mode to allow all unsigned plugins.
{{% /admonition %}}

## Learn more

- [Browse plugins](/grafana/plugins)
- [Develop plugins](/developers/plugin-tools)
- [Plugin development Community](https://community.grafana.com/c/plugin-development/30)
