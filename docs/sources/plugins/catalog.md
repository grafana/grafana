+++
title = "Plugin catalog"
aliases = ["/docs/grafana/v8.0/plugins/catalog/"]
weight = 1
+++

# Plugin catalog

The plugin catalog allows you to browse and manage plugins from within Grafana. Only a Grafana server administrator can access and use the catalog.

> **Note:** The plugin catalog is designed to work with a single Grafana server instance only. Support for Grafana clusters will be added in future Grafana releases.

<div class="medium-6 columns">
  <video width="700" height="600" controls>
    <source src="/static/assets/videos/plugins-catalog-install-8-0.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

Before you can use the plugin catalog, you must enable it in the Grafana [configuration]({{< relref "../administration/configuration.md#plugin_admin_enabled" >}}) file.
Before following the steps below, make sure you are logged in as a Grafana administrator.

## Browse plugins

To browse available plugins:

1. In Grafana, navigate to **Configuration > Plugins**.
1. Click **Install &amp; manage plugins**.

You can also browse existing plugins by navigating to the **Library** tab.

![Plugin catalog browse](/static/img/docs/plugins/plugins-catalog-browse-8-0.png)

## Install a plugin

1. In Grafana, navigate to **Configuration > Plugins**.
1. Click **Install &amp; manage plugins**.
1. Browse and find a plugin.
1. Click on the plugin logo.
1. Click **Install**. 

A confirmation message opens notifying that the installation was successful.

![Plugin catalog install](/static/img/docs/plugins/plugins-catalog-install-8-0.png)

## Update a plugin

1. In Grafana, navigate to **Configuration > Plugins**.
1. Click **Install &amp; manage plugins**.
1. Navigate to the **Library** tab.
1. Click on the plugin logo.
1. Click **Update**.

A confirmation message opens notifying that the installation was successful.

![Plugin catalog update](/static/img/docs/plugins/plugins-catalog-update-8-0.png)

## Uninstall a plugin

1. In Grafana, navigate to **Configuration > Plugins**.
1. Click **Install &amp; manage plugins**.
1. Navigate to the **Library** tab.
1. Click on the plugin logo.
1. Click **Uninstall**.

A confirmation message opens notifying that the installation was successful.
   
![Plugin catalog uninstall](/static/img/docs/plugins/plugins-catalog-uninstall-8-0.png)
