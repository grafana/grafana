+++
title = "Basic Concepts"
description = "Grafana intro and concept guide"
keywords = ["grafana", "intro", "guide", "concepts"]
type = "docs"
[menu.docs]
name = "Basic concepts"
identifier = "basic_concepts"
parent = "guides"
weight = 2
+++

# Basic concepts

This document is an introduction to basic concepts in Grafana. Use it as a starting point to get familiar with core Grafana features.

## Dashboard

The *dashboard* is where it all comes together. A dashboard is a set of one or more panels organized and arranged into one or more rows.

The time period for the dashboard can be controlled by the [Time range controls]({{< relref "../reference/timerange.md" >}}) in the upper right of the dashboard.

Dashboards can use [templating]({{< relref "../reference/templating.md" >}}) to make them more dynamic and interactive.

Dashboards can use [annotations]({{< relref "../reference/annotations.md" >}}) to display event data across panels. This can help correlate the time series data in the panel with other events.

Dashboards can be [shared]({{< relref "../reference/share_dashboard.md" >}}) easily in a variety of ways.

Dashboards can be tagged, and the dashboard picker provides quick, searchable access to all dashboards in a particular organization.

## Data source

Grafana can visualize, explore, and alert on data from many different databases and cloud services. Each database or service type is accessed from a *data source*. 

Each data source has a specific query editor that is customized for the features and capabilities that the particular data source exposes. The query language and capabilities of each data source are obviously very different. You can combine data from multiple data sources into a single dashboard, but each panel is connected to a specific data source that belongs to a particular organization.

Refer to the [Data sources section]({{< relref "../features/datasources" >}}) for a list of data sources that Grafana officially supports.

## Organization

Grafana supports multiple *organizations* in order to support a wide variety of deployment models, including using a single Grafana instance to provide service to multiple potentially untrusted organizations.

In most cases, Grafana is deployed with a single organization.

Each organization can have one or more data sources.

All dashboards are owned by a particular organization.

 > Note: Most metric databases do not provide per-user series authentication. This means that organization data sources and dashboards are available to all users in a particular organization.

Refer to [Organization roles]({{< relref "../permissions/organization_roles.md" >}}) for more information.

## Panel

The *panel* is the basic visualization building block in Grafana. Each panel has a Query Editor specific to the data source selected in the panel. The query editor allows you to extract the perfect visualization to display on the panel.

There are a wide variety of styling and formatting options for each panel. Panels can be dragged and dropped and rearranged on the Dashboard. They can also be resized.

Panels like the [Graph]({{< relref "../features/panels/graph.md" >}}) panel allow you to graph as many metrics and series as you want. Other panels like [Singlestat]({{< relref "../features/panels/singlestat.md" >}}) require a reduction of a single query into a single number.

Panels can be made more dynamic with [Dashboard Templating]({{< relref "../reference/templating.md" >}}) variable strings within the panel configuration. The template can include queries to your data source configured in the Query Editor.

Panels can be [shared]({{< relref "../reference/share_panel.md" >}}) easily in a variety of ways.

## Query editor

The *query editor* exposes capabilities of your data source and allows you to query the metrics that it contains.

Use the query editor to build one or more queries in your time series database. The panel instantly updates, allowing you to effectively explore your data in real time and build a perfect query for that particular panel.

You can use [template variables]({{< relref "../reference/templating.md" >}}) in the query editor within the queries themselves. This provides a powerful way to explore data dynamically based on the templating variables selected on the dashboard.

Grafana allows you to reference queries in the query editor by the row that they’re on. If you add a second query to graph, you can reference the first query by typing in #A. This provides an easy and convenient way to build compound queries.

## Row

A *row* is a logical divider within a dashboard. It is used to group panels together.

Rows are always 12 “units” wide. These units are automatically scaled dependent on the horizontal resolution of your browser. You can control the relative width of panels within a row by setting their specific width.

We use a unit abstraction so that Grafana looks great on all screens sizes.

 > Note: With MaxDataPoint functionality, Grafana can show you the perfect number of data points, regardless of resolution or time range.

Collapse a row by clicking on the row title. If you save a dashboard with a row collapsed, then it saves in that state and does not load those graphs until you expand the row.

Use the [repeating rows]({{< relref "../reference/templating.md#repeating-rows" >}}) functionality to dynamically create or remove entire rows, which can be filled with panels, based on the template variables selected.

## User

A *user* is a named account in Grafana. A user can belong to one or more organizations and can be assigned different levels of privileges through roles.

Grafana supports a wide variety of internal and external ways for users to authenticate themselves. These include from its own integrated database, from an external SQL server, or from an external LDAP server.

Refer to the [Permissions overview](docs\sources\permissions\overview.md) for information about roles and permissions.
