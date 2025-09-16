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

Plugins enhance your Grafana experience with new ways to connect to and visualize data.

Read on for an overview on how to get started with plugins:

- Plugins are available in the [plugin catalog](#plugin-catalog). They can be built by Grafana Labs, commercial partners, our community, or you can [build a plugin yourself](/developers/plugin-tools).
- There are three [types of plugins](#types-of-plugins): panel, data source, and app plugins.
- Learn [how to install](#install-a-plugin), [update](#update-a-plugin) and [verify](#verify-your-plugins) your plugins.

[Advanced options](#advanced-options) allow you to:

- Customize where app plugin pages appear in the navigation menu.
- Configure backend communication between installed plugins.
- Improve security by isolating plugins with the Plugin Frontend Sandbox.

## Types of plugins

Grafana supports three types of plugins:

- [Panels](/grafana/plugins/panel-plugins) - These plugins make it easy to create and add any kind of visualization, to show your data, or improve your favorite dashboards.
- [Data sources](/grafana/plugins/data-source-plugins) - These plugins allow you to pull data from various data sources such as databases, APIs, log files, and so on, and display it in the form of graphs, charts, and dashboards in Grafana.
- [Apps](/grafana/plugins/app-plugins) - These plugins enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

Read more in [Types of plugins](plugin-types).

## Plugin catalog

The Grafana plugin catalog allows you to browse and manage plugins from within Grafana. Only Grafana server administrators and Organization administrators can access and use the plugin catalog. For more information about Grafana roles and permissions, refer to [Roles and permissions](../roles-and-permissions/).

The following access rules apply depending on the user role:

- If you are an **Org Admin**, you can configure app plugins, but you can't install, uninstall, or update them.
- If you are a **Server Admin**, you can't configure app plugins, but you can install, uninstall, or update them.
- If you are both **Org Admin** and **Server Admin**, you can configure app plugins and also install, uninstall, or update them.

### Browse plugins

To browse for available plugins:

1. While logged into Grafana as an administrator, click **Administration > Plugins and data > Plugins** in the side menu to view installed and available plugins.
1. Use the search box to filter based on name, keywords, organization and other metadata.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

## Manage your plugins

We strongly recommend running the latest plugin version. Use [Grafana Advisor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor) to check the status of your data sources and plugins.

### Install a plugin

The most common way to install a plugin is through the Grafana UI.

1. In Grafana, click **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Browse and find a plugin.
1. Click the plugin's logo.
1. Click **Install**.

{{< admonition type="note" >}}
To see additional ways to install plugins refer to [Install a plugin](plugin-install).
{{< /admonition >}}

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

### Verify your plugins

Plugin signature verification, also known as _signing_, is a security measure to make sure plugins haven't been tampered with. Upon loading, Grafana checks to see if a plugin is signed or unsigned. Read more in [Plugin signatures](plugin-sign).

## Advanced options

### Customize navigation placement of plugin pages

You can relocate app plugin pages to customize the navigation menu structure, as explained in [Customize navigation placement of plugin pages](customize-nav-bar).

### Allow plugin backend communication

You can configure your Grafana instance to let the frontends of installed plugins directly communicate locally with the backends of other installed plugins. See how in [Configure backend communication between installed plugins](plugin-integrate).

### Isolate plugin code with the Frontend Sandbox

You can use the [Plugin Frontend Sandbox](plugin-frontend-sandbox) to securely isolate plugin frontend code from the main Grafana application.

When enabled, plugins run in a separate JavaScript context, which provides several security benefits:

- Prevents plugins from modifying parts of the Grafana interface outside their designated areas
- Stops plugins from interfering with other plugins functionality
- Protects core Grafana features from being altered by plugins
- Prevents plugins from modifying global browser objects and behaviors

### Learn more

- [Browse available plugins](/grafana/plugins)
- [Develop your own plugins](/developers/plugin-tools)
- [Reach out to the plugin development Community](https://community.grafana.com/c/plugin-development/30)
