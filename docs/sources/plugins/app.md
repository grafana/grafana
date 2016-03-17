---
page_title: App plugin
page_description: App plugin for Grafana
page_keywords: grafana, plugins, documentation
---

 > Our goal is not to have a very extensive documentation but rather have actual code that people can look at. An example implementation of an app can be found in this [example app repo](https://github.com/grafana/example-app)

# Apps

App plugins is a new kind of grafana plugin that can bundle datasource and panel plugins within one package. It also enable the plugin author to create custom pages within grafana. The custom pages enables the plugin author to include things like documentation, sign up forms or controlling other services using HTTP requests.

Datasource and panel plugins will show up like normal plugins. The custom pages will be available in the main menu.

## README.md

The readme file in the mounted folder will show up in the overview tab on the app page.

## Module exports
```javascript
export {
  ExampleAppConfigCtrl as ConfigCtrl,
  StreamPageCtrl,
  LogsPageCtrl
};
```
The only required export is the ConfigCtrl. Both StreamPageCtrl and LogsPageCtrl are custom pages defined in plugin.json

## Custom pages
Custom pages are defined in the plugin.json like this.
```json
"pages": [
  { "name": "Live stream", "component": "StreamPageCtrl", "role": "Editor"},
  { "name": "Log view", "component": "LogsPageCtrl", "role": "Viewer"}
]
```
The component field have to match one of the components exported in the module.js in the root of the plugin.

## Bundled plugins

When Grafana starts it will scan all directories within an app plugin and load folders containing a plugin.json as an plugin.
