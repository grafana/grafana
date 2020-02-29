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

## Plugin.json Schema

| Property                    | Description                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| id                          | Unique name of the plugin. See [naming conventions described in styleguide]({{< relref "code-styleguide.md" >}})              |
| type                        | One of `app`, `datasource`, `panel`                                                                                           |
| name                        | Human-readable name of the plugin                                                                                             |
| dependencies.grafanaVersion | Required Grafana version for this plugin                                                                                      |
| dependencies.plugins        | An array of required plugins on which this plugin depends                                                                     |
| info.author.name            | Author's name                                                                                                                 |
| info.author.url             | Link to author's website                                                                                                      |
| info.description            | Description of plugin. Used for search on grafana.com                                                                         |
| info.keywords               | Array of plugin keywords. Used for search on grafana.com                                                                      |
| info.links                  | An array of link objects to be displayed on this plugin's project page in the form `{name: 'foo', url: 'http://example.com'}` |
| info.logos.small            | Link to the "small" version of the plugin logo, which must be an SVG image. "Large" and "small" logos can be the same image. |
| info.logos.large            | Link to the "large" version of the plugin logo, which must be an SVG image. "Large" and "small" logos can be the same image. |
| info.screenshots            | An array of screenshot objects in the form `{name: 'bar', path: 'img/screenshot.png'}`                                        |
| info.updated                | Date when this plugin was built. Use `%TODAY%` for Grafana to autopopulate this value.                                        |
| info.version                | Project version of this commit. Use `%VERSION%` for Grafana to autopopulate this value.                                      |

## Plugin.json Example

Here's an example of an up-to-date plugin.json file:

https://github.com/grafana/clock-panel/blob/master/src/plugin.json
