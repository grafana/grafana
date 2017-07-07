---
page_title: App plugin
page_description: App plugin for Grafana
page_keywords: grafana, plugins, documentation
---


# Apps

App plugins is a new kind of grafana plugin that can bundle datasource and panel plugins within one package. It also enable the plugin author to create custom pages within grafana. The custom pages enables the plugin author to include things like documentation, sign up forms or controlling other services using HTTP requests.

Datasource and panel plugins will show up like normal plugins. The app pages will be available in the main menu.

<img class="no-shadow" src="/img/v3/app-in-main-menu.png">

## Enabling app plugins
After installing an app it have to be enabled before it show up as an datasource or panel. You can do that on the app page in the config tab.

### Develop your own App

> Our goal is not to have a very extensive documentation but rather have actual
> code that people can look at. An example implementation of an app can be found
> in this [example app repo](https://github.com/grafana/example-app)

