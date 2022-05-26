---
keywords:
  - grafana
  - documentation
  - developers
  - resources
title: Angular support deprecation
---

# Angular support deprecation

Angular plugin support is deprecated, and it will be removed in a future release. There are still many community plugins that depend on Grafana’s angular plugin support for them to work. The same is true for many internal (private) plugins developed over the years by Grafana users. Grafana version 9 will have a server configuration option, global for the whole instance, that will control if angular plugin support is available or not. By default, angular plugin support will be disabled.

## Why are we deprecating angular support?

AngularJS is an old frontend framework that stopped active development many years ago. As a result, it is a security risk. AngularJS also requires unsafe-eval in the CSP (Content Security Policy) settings which also reduces the security level of how javascript is executed in the browser.

## When will angular plugins stop working?

In Grafana version 9 coming in June 2022, all angular plugins will stop working unless a new server configuration option is turned on. If you still depend on community or internally developed plugins that require AngularJS then you will have to turn this option on.

This is a good time to start working on migrating plugins to React.

Our plan is to fully remove angular plugin support in version 10 released in 2023. Meaning all plugins that do depend on angular will stop working and this temporary option to enable it introduced in v9 will be removed.

## How do I migrate an angular plugin to React?

Depending on if it’s a data source plugin, panel plugin, or app plugin the process will differ.

For panels, the rendering logic could in some cases be easily preserved but all options need to be redone to use the declarative options framework. For data source plugins the query editor and config options will likely need a total rewrite.

### Links

- [Migrate Angular to React](https://grafana.com/docs/grafana/latest/developers/plugins/migration-guide/#migrate-a-plugin-from-angular-to-react)
- [Build a panel plugin](https://grafana.com/tutorials/build-a-panel-plugin/)
- [Build a data source plugin](https://grafana.com/tutorials/build-a-data-source-plugin/)
