+++
title = "Installing Plugins"
type = "docs"
[menu.docs]
parent = "plugins"
weight = 1
+++

# Grafana Plugins

From Grafana 3.0+ not only are datasource plugins supported but also panel plugins and apps.
Having panels as plugins make it easy to create and add any kind of panel, to show your data
or improve your favorite dashboards. Apps is something new in Grafana that enables
bundling of datasources, panels, dashboards and Grafana pages into a cohesive experience.

Grafana already have a strong community of contributors and plugin developers.
By making it easier to develop and install plugins we hope that the community
can grow even stronger and develop new plugins that we would never think about.

To discover plugins checkout the official [Plugin Repository](https://grafana.com/plugins).

# Installing Plugins

The easiest way to install plugins is by using the CLI tool grafana-cli which is bundled with grafana. Before any modification take place after modifying plugins, grafana-server needs to be restarted.

### Grafana Plugin Directory

On Linux systems the grafana-cli will assume that the grafana plugin directory is `/var/lib/grafana/plugins`. It's possible to override the directory which grafana-cli will operate on by specifying the --pluginsDir flag. On Windows systems this parameter have to be specified for every call.

### Grafana-cli Commands

List available plugins
```bash
grafana-cli plugins list-remote
```

Install the latest version of a plugin
```bash
grafana-cli plugins install <plugin-id>
```

Install a specific version of a plugin
```bash
grafana-cli plugins install <plugin-id> <version>
```

List installed plugins
```bash
grafana-cli plugins ls
```

Update all installed plugins
```bash
grafana-cli plugins update-all
```

Update one plugin
```bash
grafana-cli plugins update <plugin-id>
```

Remove one plugin
```bash
grafana-cli plugins remove <plugin-id>
```

### Installing Plugins Manually

If your Grafana Server does not have access to the Internet, then the plugin will have to downloaded and manually copied to your Grafana Server.

The Download URL from Grafana.com API is in this form:

`https://grafana.com/api/plugins/<plugin id>/versions/<version number>/download`

You can specify a local URL by using the `--pluginUrl` option.
```bash
grafana-cli --pluginUrl https://nexus.company.com/grafana/plugins/<plugin-id>-<plugin-version>.zip plugins install <plugin-id>
```

To manually install a Plugin via the Grafana.com API:

1. Find the plugin you want to download, the plugin id can be found on the Installation Tab on the plugin's page on Grafana.com. In this example, the plugin id is `jdbranham-diagram-panel`:

    {{< imgbox img="/img/docs/installation-tab.png" caption="Installation Tab" >}}

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
