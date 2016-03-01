---
page_title: Plugin installation
page_description: Plugin installation for Grafana
page_keywords: grafana, plugins, documentation
---

# Plugins

## Installing plugins

The easiest way to install plugins is by using the CLI tool grafana-cli which is bundled with grafana.

### Grafana plugin directory
On Linux systems the grafana-cli will assume that the grafana plugin directory is "/var/lib/grafana/plugins". Its possible to override the directory which grafana-cli will operate on by specifing the --path flag. On Windows systems this parameter have to be specified for every call.

### List available plugins
```
grafana-cli list-remove
```

### Install a plugin type
```
grafana-cli install <plugin-id>
```

### List installed plugins
```
grafana-cli ls
```

### Upgrade all installed plugins
```
grafana-cli upgrade-all
```

### Upgrade one plugin
```
grafana-cli upgrade <plugin-id>
```

### Remove one plugin
```
grafana-cli remove <plugin-id>
```
