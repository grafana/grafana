---
page_title: Plugin guide
page_description: Plugin guide for Grafana
page_keywords: grafana, plugins, documentation
---

# Plugins

!Plugin support for panels is only available in nightly!

Adding support for all datasources and suggested panels would bloat grafana and make it impossible to maintain. That's why we implemented a plugin system that makes it possible for anyone to develop support for a datasource or custom panel without adding it to Grafana itself.

## Installing plugins

Installing a plugin is very simple. Just download it and place it in the Grafana plugins folder and restart grafana.

The default plugin folder is configurable under paths.plugins

It's also possible to add one specific plugin by linking to its folder.

```
[plugin.mirror]
path = /home/evil-queen/datasource-plugin-mirror
```

## Plugin implementation ##

Each plugin is defined in plugin.json file in the plugin folder.

Instead of massive documentation about how it works we created a reference implementation of a plugin.
You can find each reference implementation further down on this page.

## Datasource plugins

Datasource have three responsibilities.

 * UI for configuring its settings
 * Datasource object that can send queries, metricqueries and healthcheck the datasource
 * Query editor within panels

https://github.com/grafana/datasource-plugin-genericdatasource

## Panel plugins

Panel plugins are responsible for

 * UI for Panel options.
 * Creating a directive that can render something based on datasource data.

We currently dont have a reference implementation for panel plugins but you can checkout https://github.com/grafana/panel-plugin-piechart
