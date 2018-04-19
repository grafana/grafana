+++
title = "What's New in Grafana v5.1"
description = "Feature & improvement highlights for Grafana v5.1"
keywords = ["grafana", "new", "documentation", "5.1"]
type = "docs"
[menu.docs]
name = "Version 5.1"
identifier = "v5.1"
parent = "whatsnew"
weight = -7
+++

# What's New in Grafana v5.1

Grafana v5.1 brings new features, many enhancements and bug fixes. This article will detail the major new features and enhancements.

* [Scrolling]({{< relref "#scrolling" >}})
* [Improved docker image]({{< relref "#improved-docker-image-breaking-change" >}}) with a breaking change!
* [Improved workflow for provisioned dashboards]({{< relref "#improved-workflow-for-provisioned-dashboards" >}})
* [New template variable interpolation syntax]({{< relref "#new-template-variable-interpolation-syntax" >}})
* [Heatmap support for Prometehus]({{< relref "#prometheus" >}}) 
* [Microsft SQL Server]({{< relref "#microsoft-sql-server" >}}) as metric & table datasource!
* [Dashboards & Panels]({{< relref "#dashboards-panels" >}}) Improved adding panels to dashboards and enhancements to Graph and Table panels.

## Scrolling



## Improved docker image (breaking change)

Grafana v5.1 brings an improved official docker image which should make it easier to run and use the Grafana docker image and at the same time give more control to the user how to use/run it.

We've switched the id of the grafana user running Grafana inside a docker container. Unfortunately this means that files created prior to 5.1 won't have the correct permissions for later versions and thereby this introduces a breaking change.
We made this change so that it would be easier for you to control what user Grafana is executed as (see examples below).

Version | User    | User ID
--------|---------|---------
< 5.1   | grafana | 104
>= 5.1  | grafana | 472

Please read the [updated documentation](/installation/docker/#migration-from-a-previous-version-of-the-docker-container-to-5-1-or-later) which includes migration instructions and more information.

## Improved workflow for provisioned dashboards

{{< docs-imagebox img="/img/docs/v51/provisioning_cannot_save_dashboard.png" max-width="800px" class="docs-image--right" >}}

Grafana v5.1 brings an improved workflow for provisioned dashboards:

* A populated `id` property in JSON is now automatically removed when provisioning dashboards.
* When making changes to a provisioned dashboard you can `Save` the dashboard which now will bring up a *Cannot save provisioned dashboard* dialog like seen in the screenshot to the right.


Available options in the dialog will let you `Copy JSON to Clipboard` and/or `Save JSON to file` which can help you synchronize your dashboard changes back to the provisioning source.
More information in the [Provisioning documentation](/features/datasources/prometheus/).

<div class="clearfix"></div>

## New template variable interpolation syntax

## Prometheus

The Prometheus datasource now support transforming Prometheus histograms to the heatmap panel. Prometheus histogram is a powerful feature, and we are really happy to finally allow our users to render those as heatmaps.

Prometheus query editor also got support for autocomplete of template variables. More information in the [Prometheus data source documentation](/features/datasources/prometheus/).

## PostgreSQL

New enhancement includes support for filling in values for missing intervals and better precision handling and data type support for time columns. More information in the [PostgreSQL data source documentation](/features/datasources/postgres/#time-series-queries).

## MySQL

New enhancements includes support for filling in values for missing intervals, better precision handling and data type support for time columns and any column except time and metric is now treated as a value column. More information in the [MySQL data source documentation](/features/datasources/mysql/#time-series-queries).

## Microsoft SQL Server

{{< docs-imagebox img="/img/docs/v51/mssql_query_editor_showcase.png"  max-width= "800px" class="docs-image--right" >}}

Grafana v5.1 now ships with a built-in Microsoft SQL Server (MSSQL) data source plugin that allows you to query and visualize data from any Microsoft SQL Server 2005 or newer, including Microsoft Azure SQL Database. Have logs or metric data in MSSQL? You can now visualize that data and
define alert rules on it like any of our other data sources.

Same enhancements as described for PostgreSQL and MySQL are included in the MSSQL datasource.

Please read [Using Microsoft SQL Server in Grafana documentation](/features/datasources/mssql/) for more detailed information on how to get started and use it.

<div class="clearfix"></div>

## Dashboards & Panels

### Adding new panels to dashboards

{{< docs-imagebox img="/img/docs/v51/dashboard_add_panel.png"  max-width= "800px" class="docs-image--right" >}}

The control for adding new panels to dashboards have got some enhancements and now includes functionality to search for the type of panel
you want to add. Further, the control has tabs separating functionality for adding new panels and pasting
copied panels.

By copying a panel in a dashboard it will be displayed in the `Paste` tab in *any* dashboard and allows you to paste the
copied panel into the current dashboard.

{{< docs-imagebox img="/img/docs/v51/dashboard_panel_copy.png"  max-width= "300px" >}}

<div class="clearfix"></div>

### Graph Panel

New enhancements includes support for multiple series stacking in histogram mode, thresholds for right Y axis, aligning left and right Y-axes to one level and additional units. More information in the [Graph panel documentation](/features/panels/graph/).

### Table Panel

New enhancements includes support for mapping a numeric value/range to text and additional units. More information in the [Table panel documentation](/features/panels/table_panel/#string).

## Changelog

Checkout the [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) file for a complete list
of new features, changes, and bug fixes.