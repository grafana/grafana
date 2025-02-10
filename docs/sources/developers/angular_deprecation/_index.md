---
keywords:
  - grafana
  - documentation
  - developers
  - resources
labels:
  products:
    - enterprise
    - oss
title: Angular support deprecation
weight: 500
---

# Angular support deprecation

Angular plugin support is deprecated and will be removed in a future release.
There are legacy core Grafana visualizations and external plugins that rely on Grafana's Angular plugin support to work. The same is likely true for [private plugins](https://grafana.com/legal/plugins/) that have been developed by Grafana users for use on their own instances over the years.
From Grafana v9 and onwards, there is a [server configuration option](https://github.com/grafana/grafana/blob/d61bcdf4ca5e69489e0067c56fbe7f0bfdf84ee4/conf/defaults.ini#L362) that's global to the entire instance and controls whether Angular plugin support is available or not.
In Grafana 11, we will change the default value for the configuration to remove support.

Warning messages are displayed if a dashboard depends on an a panel visualization or data source which requires AngularJS as shown in the following video:

{{< youtube id="XlEVs6g8dC8" >}}

To avoid disruption:

- Ensure that you are running the latest version of plugins by following this guide on [updating]({{< relref "../../administration/plugin-management/#update-a-plugin" >}}). Many panels and data sources have migrated from AngularJS.
- If you are using legacy Core Grafana visualizations such as Graph or Table-old, migrate to their replacements using the provided [automatic migrations]({{< relref "./angular-plugins/#automatic-migration-of-plugins" >}}).
- Review the [list of current Angular plugins]({{< relref "./angular-plugins/" >}}) to discover which Core and external plugins are impacted, and whether an update or alternative is required.

## Why are we deprecating Angular support?

AngularJS is an old frontend framework whose active development stopped many years ago. Therefore, it poses a security risk. As Grafana itself had already started migrating to React in v5, this presented the most logical framework for our plugin platform. AngularJS also requires unsafe-eval in the CSP (Content Security Policy) settings, which also reduces the security of running JavaScript in the browser.

## When will Angular plugins stop working?

In Grafana 11, which will be released in preview in April 2024 and generally available in May, we will change the default behavior of the [angular_support_enabled](https://github.com/grafana/grafana/blob/d61bcdf4ca5e69489e0067c56fbe7f0bfdf84ee4/conf/defaults.ini#L362) configuration parameter to turn off support for AngularJS based plugins. In case you still rely on [AngularJS-based plugins]({{< relref "./angular-plugins/" >}}) developed internally or by the community, you will need to enable this option to continue using them.

New Grafana Cloud users will be unable to request for support to be added to their instance.

## When will we remove Angular support completely?

Our current plan is to completely remove any remaining support for Angular plugins in version 12. Including the removal of the [angular_support_enabled](https://github.com/grafana/grafana/blob/d61bcdf4ca5e69489e0067c56fbe7f0bfdf84ee4/conf/defaults.ini#L362) configuration parameter.

## A dashboard I use is displaying a warning, what do I need to do?

A dashboard displays warnings when one or more panel visualizations or data sources in the dashboard have a dependency on Angular.
Contact your system administrator to advise them of the issue or follow the preceding guidance on avoiding disruption.

## How do I migrate an Angular plugin to React?

Depending on if it’s a data source plugin, panel plugin, or app plugin the process will differ.

For panels, the rendering logic could in some cases be easily preserved, but all options need to be redone to use the declarative options framework. For data source plugins the query editor and config options will likely need a total rewrite.

## How do I encourage a community plugin to migrate?

We encourage you to locate the repository of the corresponding plugin and create or upvote an Issue within it if you are using a plugin that is still based on Angular.

### Links

- [Migrate Angular to React](https://grafana.com/developers/plugin-tools/migration-guides/angular-react/)
- [Build a panel plugin](https://grafana.com/tutorials/build-a-panel-plugin/)
- [Build a data source plugin](https://grafana.com/tutorials/build-a-data-source-plugin/)
- [List of current Angular plugins]({{< relref "./angular-plugins/" >}})
