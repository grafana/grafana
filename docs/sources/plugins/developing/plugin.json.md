+++
title = "plugin.json Schema"
keywords = ["grafana", "plugins", "documentation"]
type = "docs"
[menu.docs]
name = "plugin.json Schema"
parent = "developing"
weight = 8
+++

# Plugin.json

The plugin.json file is mandatory for all plugins. When Grafana starts it will scan the plugin folders and mount every folder that contains a plugin.json file unless the folder contains a subfolder named `dist`. In that case grafana will mount the `dist` folder instead.

## Plugin JSON Schema

| Property | Description |
| ------------- |-------------|
| id | unique name of the plugin - [conventions described in styleguide]({{< relref "code-styleguide.md" >}}) |
| type | panel/datasource/app |
| name | Human readable name of the plugin |
| info.description | Description of plugin. Used for searching grafana.com plugins |
| info.author | |
| info.keywords | plugin keywords. Used for search on grafana net|
| info.logos | link to project logos |
| info.version | project version of this commit. Must be semver |
| dependencies.grafanaVersion | Required grafana backend version for this plugin |
| dependencies.plugins | required plugins for this plugin. |
