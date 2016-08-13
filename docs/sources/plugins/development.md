---
page_title: Plugin development guide
page_description: Plugin development for Grafana
page_keywords: grafana, plugins, documentation, development
---

# Plugin development

From grafana 3.0 it's very easy to develop your own plugins and share them with other grafana users.

## Short version

1. [Setup grafana](http://docs.grafana.org/project/building_from_source/)
2. Clone an example plugin into ```/var/lib/grafana/plugins```  or `data/plugins` (relative to grafana git repo if your running development version from source dir)
3. Code away!

## What languages?

Since everything turns into javascript it's up to you to choose which language you want. That said it's probably a good idea to choose es6 or typescript since we use es6 classes in Grafana. So it's easier to get inspiration from the Grafana repo is you choose one of those languages.

## Buildscript

You can use any build system you like that support systemjs. All the built content should end up in a folder named ```dist``` and committed to the repository.By committing the dist folder the person who installs your plugin does not have to run any buildscript.

All our example plugins have build scripted configured.

## module.(js|ts)

This is the entry point for every plugin. This is the place where you should export
your plugin implementation. Depending on what kind of plugin you are developing you
will be expected to export different things. You can find what's expected for [datasource](./datasources.md), [panels](./panels.md)
and [apps](./apps.md) plugins in the documentation.

## Start developing your plugin
There are three ways that you can start developing a Grafana plugin.

1. Setup a Grafana development environment. [(described here)](http://docs.grafana.org/project/building_from_source/) and place your plugin in the ```data/plugins``` folder.
2. Install Grafana and place your plugin in the plugins directory which is set in your [config file](../installation/configuration.md). By default this is `/var/lib/grafana/plugins` on Linux systems.
3. Place your plugin directory anywhere you like and specify it grafana.ini.

We encourage people to setup the full Grafana environment so that you can get inspiration from the rest of grafana code base.

When Grafana starts it will scan the plugin folders and mount every folder that contains a plugin.json file unless
the folder contains a subfolder named dist. In that case grafana will mount the dist folder instead.
This makes it possible to have both built and src content in the same plugin git repo.

## Examples
We currently have three different examples that you can fork/download to get started developing your grafana plugin.

 - [simple-json-datasource](https://github.com/grafana/simple-json-datasource) (small datasource plugin for querying json data from backends)
 - [piechart-panel](https://github.com/grafana/piechart-panel)
 - [example-app](https://github.com/grafana/example-app)
