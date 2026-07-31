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

- Plugins are available in the [plugin catalog](#access-the-plugin-catalog). They can be built by Grafana Labs, commercial partners, our community, or you can [build a plugin yourself](/developers/plugin-tools).
- There are three [types of plugins](#types-of-plugins): panel, data source, and app plugins.
- Learn [how to install](#install-a-plugin), [update](#update-a-plugin) and [verify](#verify-your-plugins) your plugins.

[Advanced options](#advanced-options) allow you to:

- Customize where app plugin pages appear in the navigation menu.
- Configure backend communication between installed plugins.
- Improve security by isolating plugins with the Plugin Frontend Sandbox.
- Choose which of the panels bundled in an app plugin your users can use.

## Types of plugins

Grafana supports three types of plugins:

- [Panels](/grafana/plugins/panel-plugins) - These plugins make it easy to create and add any kind of visualization, to show your data, or improve your favorite dashboards.
- [Data sources](/grafana/plugins/data-source-plugins) - These plugins allow you to pull data from various data sources such as databases, APIs, log files, and so on, and display it in the form of graphs, charts, and dashboards in Grafana.
- [Apps](/grafana/plugins/app-plugins) - These plugins enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

Read more in [Types of plugins](plugin-types).

## Access the Plugin catalog

You can install and manage plugins from within Grafana. You need to have a Grafana Server administrator or Organization administrator role to access and use the plugin catalog. For more information about Grafana roles and permissions, refer to [Roles and permissions](../roles-and-permissions/).

For app plugins, the following access rules apply:

- If you are an **Org Admin**, you can configure app plugins, but you can't install, uninstall, or update them.
- If you are a **Server Admin**, you can't configure app plugins, but you can install, uninstall, or update them.
- If you are both **Org Admin** and **Server Admin**, you can configure app plugins and also install, uninstall, or update them.

### Browse plugins

To browse for available plugins:

1. While logged into Grafana as an administrator, click **Administration > Plugins and data > Plugins** in the side menu to view installed and available plugins.
1. Use the search box to filter based on name, keywords, organization and other metadata.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

If you're not logged in, you can also access the list of available plugins in the [Plugin catalog](https://grafana.com/grafana/plugins/).

## Manage your plugins

We strongly recommend running the latest plugin version. Use [Grafana Advisor](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/grafana-advisor) to check the status of your data sources and plugins.

### Install a plugin

The default way to install a plugin is through the Grafana UI.

1. In Grafana, go to **Administration > Plugins and data > Plugins** in the side navigation menu to view all plugins.
1. Browse and find the plugin you want to install.
1. Click on the plugin's logo.
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

When the update is complete, a confirmation message indicates the installation was successful.

#### Update Grafana-managed plugins

{{< admonition type="note" >}}
Available in [Grafana Cloud](/docs/grafana-cloud).
{{< /admonition >}}

In Grafana Cloud, most plugins are automatically kept up to date. When a new version is available it’s updated on your behalf, and you don’t need to take any action. For more information and exceptions, refer to [Updates to Grafana-managed plugins](https://grafana.com/docs/grafana-cloud/introduction/find-and-use-plugins/#updates-to-grafana-managed-plugins) in the Grafana Cloud documentation.

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

### Disable an individual plugin included in an app

An app plugin bundles other plugins, and those bundled plugins don't always reach the same maturity at the same time. When an app ships several panels and only some of them are ready for your users, you can disable the panels you don't want to offer instead of choosing between the whole app and none of it.

This applies to panel plugins included in an app. Data source plugins included in an app aren't affected, because Grafana needs their definitions to load the data sources that already use them.

To disable a panel included in an app, post to the plugin settings endpoint with the ID of the included panel:

```sh
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ACCOUNT_TOKEN>" \
  -d '{"enabled": false, "pinned": false}' \
  http://localhost:3000/api/plugins/<INCLUDED_PLUGIN_ID>/settings
```

Replace the following placeholders:

- _`<SERVICE_ACCOUNT_TOKEN>`_: a token for an account with the `plugins:write` permission, which Grafana grants to the Organization administrator role by default.
- _`<INCLUDED_PLUGIN_ID>`_: the ID of the panel included in the app, not the ID of the app itself.

An app's own configuration page is the expected way to make this choice, so refer to the app's documentation before you call the API directly. To offer the panel again, repeat the request with `"enabled": true`.

Keep the following in mind:

- **The setting applies to one organization:** Grafana stores plugin settings per organization and plugin, so organizations on the same Grafana instance can offer different sets of panels.
- **The change takes effect on the next page load:** you don't need to restart Grafana. Reload the browser to pick up the new set of panels.
- **Disabling the app itself doesn't disable the panels it includes:** disable each panel you want to withhold.
- **Dashboards that already use a disabled panel still open:** the panel shows a "Panel plugin not found" message, and you can change it to another visualization or remove it.
- **Disabling a panel hides it, it doesn't block access to it:** Grafana withholds the panel from the frontend, but the plugin's assets stay reachable under `/public/plugins/`. Use this to control what your users are offered, not as a security boundary.

You can also apply this setting with [plugin provisioning](../provisioning/#plugins). The `apps` block accepts any plugin ID, including the ID of a panel included in an app:

```yaml
apiVersion: 1

apps:
  - type: <INCLUDED_PLUGIN_ID>
    org_id: 1
    disabled: true
```

The block is named `apps` for historical reasons.

{{< admonition type="caution" >}}
Grafana reapplies provisioned plugin settings every time it starts. A provisioned entry overwrites changes you make through the API or an app's configuration page the next time you restart Grafana.
{{< /admonition >}}

### Learn more

- [Browse available plugins](/grafana/plugins)
- [Develop your own plugins](/developers/plugin-tools)
- [Reach out to the plugin development Community](https://community.grafana.com/c/plugin-development/30)

To administer, update, or delete your plugins, or to submit a new plugin, sign in to the [Plugins Admin page](https://grafana.com/orgs/grafana/plugins). Note that you need to be an administrator for the Grafana Cloud organization being used to publish the plugin.
