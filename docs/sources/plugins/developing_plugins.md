---
page_title: Plugin development
page_description: Plugin development for Grafana
page_keywords: grafana, plugins, documentation, development
---

# Plugin development

From grafana 3.0 it's very easy to develop your own plugins and share them with other grafana users.

## What languages?

Since everything turns into javascript its up to you to choose which language you want. That said its proberbly a good idea to choose es6 or typescript since we use es6 classes in Grafana.

##Buildscript

You can use any buildsystem you like that support systemjs. All the built content should endup in a folder named dist and commited to the repository.

##Loading plugins
The easiset way to try your plugin with grafana is to [setup grafana for development](https://github.com/grafana/grafana/blob/master/DEVELOPMENT.md) and place your plugin in the /data/plugins folder in grafana. When grafana starts it will scan that folder for folders that contains a plugin.json file and mount them as plugins. If your plugin folder contains a folder named dist it will mount that folder instead of the plugin base folder.

## Examples / boilerplate
We currently have three different examples that you can fork to get started developing your grafana plugin.

 - [generic-datasource](https://github.com/grafana/grafana/tree/master/examples/datasource-plugin-genericdatasource) (small datasource plugin for quering json data from backends)
 - [panel-boilderplate-es5](https://github.com/grafana/grafana/tree/master/examples/panel-boilerplate-es5)
 - [nginx-app](https://github.com/grafana/grafana/tree/master/examples/nginx-app)

## Publish your plugin
We are currently working on this.
