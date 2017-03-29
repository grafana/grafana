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

# Installing plugins

The easiest way to install plugins is by using the CLI tool grafana-cli which is bundled with grafana. Before any modification take place after modifying plugins, grafana-server needs to be restarted.

### Grafana plugin directory

On Linux systems the grafana-cli will assume that the grafana plugin directory is `/var/lib/grafana/plugins`. It's possible to override the directory which grafana-cli will operate on by specifying the --pluginsDir flag. On Windows systems this parameter have to be specified for every call.

### Grafana-cli commands

List available plugins
```
grafana-cli plugins list-remote
```

Install the latest version of a plugin
```
grafana-cli plugins install <plugin-id>
```

Install a specific version of a plugin
```
grafana-cli plugins install <plugin-id> <version>
```

List installed plugins
```
grafana-cli plugins ls
```

Update all installed plugins
```
grafana-cli plugins update-all
```

Update one plugin
```
grafana-cli plugins update <plugin-id>
```

Remove one plugin
```
grafana-cli plugins remove <plugin-id>
```
