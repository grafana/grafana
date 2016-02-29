---
page_title: Plugin installation
page_description: Plugin installation for Grafana
page_keywords: grafana, plugins, documentation
---

# Plugins

## Installing plugins

The easiest way to install plugins is by using the CLI tool grafana-cli which is bundled with grafana.

To list available plugins
```
grafana-cli list-remove
```

To install a plugin type
```
grafana-cli install <plugin-id>
```

To list installed plugins
```
grafana-cli ls
```

to upgrade all installed plugins
```
grafana-cli upgrade-all
```
