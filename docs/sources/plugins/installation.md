+++
title = "Install plugins"
type = "docs"
aliases = ["/docs/plugins/installation/"]
[menu.docs]
parent = "plugins"
weight = 1
+++

# Install Grafana plugins

Grafana supports data source, panel, and app plugins. Having panels as plugins makes it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards. Apps enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

1. In a web browser, navigate to the official [Grafana Plugins page](https://grafana.com/plugins) and find a plugin that you want to install.
2. Click the plugin, and then click the **Installation** tab.

## Install plugin on Grafana Cloud

On the Installation tab, in the **For** field, click the name of the Grafana instance that you want to install the plugin on.

Grafana Cloud handles the plugin installation automatically.

## Install plugin on local Grafana

Follow the instructions on the Install tab. You can either install the plugin with a Grafana CLI command or by downloading and uncompress a .zip file into the Grafana plugins directory. We recommend using Grafana CLI in most instances. The .zip option is available if your Grafana server does not have access to the internet.

For more information about Grafana CLI plugin commands, refer to [Plugin commands]({{< relref "../administration/cli.md#plugins-commands" >}}).
