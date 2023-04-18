---
aliases:
  - /docs/grafana/latest/plugins/catalog/
title: Plugin catalog
weight: 1
---

# Plugin catalog

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

In order to be able to install / uninstall / update plugins using plugin catalog, you must enable it via the `plugin_admin_enabled` flag in the [configuration]({{< relref "../administration/configuration.md#plugin_admin_enabled" >}}) file.
Before following the steps below, make sure you are logged in as a Grafana administrator.

<a id="#plugin-catalog-entry"></a>
Currently, there are two entry points to the Plugin catalog.

- Grafana server administrators can find it at **Server Admin >
  Plugins**.
- Organization administrators can find it at **Configuration > Plugins**.

## Browse plugins

To browse for available plugins:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click the **All** filter to browse all available plugins.
1. Click the **Data sources**, **Panels**, or **Applications** buttons to filter by plugin type.

![Plugin catalog browse](/static/img/docs/plugins/plugins-catalog-browse-8-1.png)

## Install a plugin

To install a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Browse and find a plugin.
1. Click on the plugin logo.
1. Click **Install**.

When the update is complete, you see a confirmation message that the installation was successful.

![Plugin catalog install](/static/img/docs/plugins/plugins-catalog-install-8-1.png)

## Update a plugin

To update a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click on the plugin logo.
1. Click **Update**.

When the update is complete, you see a confirmation message that the update was successful.

![Plugin catalog update](/static/img/docs/plugins/plugins-catalog-update-8-1.png)

## Uninstall a plugin

To uninstall a plugin:

1. In Grafana, [navigate to the Plugin catalog](#plugin-catalog-entry) to view installed plugins.
1. Click on the plugin logo.
1. Click **Uninstall**.

When the update is complete, you see a confirmation message that the uninstall was successful.

![Plugin catalog uninstall](/static/img/docs/plugins/plugins-catalog-uninstall-8-1.png)
