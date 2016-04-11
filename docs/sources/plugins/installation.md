---
page_title: Plugin installation
page_description: Plugin installation for Grafana
page_keywords: grafana, plugins, documentation
---

# Installing plugins

The easiest way to install plugins is by using the CLI tool grafana-cli which is bundled with grafana. Before any modification take place after modifying plugins, grafana-server needs to be restarted.

### Grafana plugin directory
On Linux systems the grafana-cli will assume that the grafana plugin directory is `/var/lib/grafana/plugins`. It's possible to override the directory which grafana-cli will operate on by specifying the --path flag. On Windows systems this parameter have to be specified for every call.

### Grafana-cli commands

List available plugins
```
grafana-cli plugins list-remote
```

Install a plugin type
```
grafana-cli plugins install <plugin-id>
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
