+++
title = "Install plugins"
type = "docs"
[menu.docs]
parent = "plugins"
weight = 1
+++

# Install Grafana plugins

Grafana supports data source, panel, and app plugins. Having panels as plugins makes it easy to create and add any kind of panel, to show your data, or improve your favorite dashboards. Apps enable the bundling of data sources, panels, dashboards, and Grafana pages into a cohesive experience.

To find plugins, check out the official [Plugins page](https://grafana.com/plugins).

# Install plugins

The easiest way to install plugins is by using the CLI tool grafana-cli.exe, which is bundled with grafana. Before any modification take place after modifying plugins, grafana-server needs to be restarted. Refer to [Grafana CLI]({{< relref "cli.md" >}}) for more information about grafana-cli commands.



### Installing Plugins Manually

If your Grafana Server does not have access to the Internet, then the plugin will have to downloaded and manually copied to your Grafana Server.

The download URL from Grafana.com API is in this form:

`https://grafana.com/api/plugins/<plugin id>/versions/<version number>/download`

You can specify a local URL by using the `--pluginUrl` option.
```bash
grafana-cli --pluginUrl https://nexus.company.com/grafana/plugins/<plugin-id>-<plugin-version>.zip plugins install <plugin-id>
```

To manually install a Plugin via the Grafana.com API:

1. Find the plugin you want to download, the plugin id can be found on the Installation Tab on the plugins page on Grafana.com. 

2. Use the Grafana API to find the plugin using this url `https://grafana.com/api/plugins/<plugin id from step 1>`. For example: https://grafana.com/api/plugins/jdbranham-diagram-panel should return:
    ```bash
    {
      "id": 145,
      "typeId": 3,
      "typeName": "Panel",
      "typeCode": "panel",
      "slug": "jdbranham-diagram-panel",
      "name": "Diagram",
      "description": "Diagram panel for grafana",
    ...
    ```

3. Find the download link:
    ```bash
    {
       "rel": "download",
       "href": "/plugins/jdbranham-diagram-panel/versions/1.4.0/download"
    }
    ```

4. Download the plugin with `https://grafana.com/api/plugins/<plugin id from step 1>/versions/<current version>/download` (for example: https://grafana.com/api/plugins/jdbranham-diagram-panel/versions/1.4.0/download). Unzip the downloaded file into the Grafana Server's `plugins` directory.

5. Restart the Grafana Server.
