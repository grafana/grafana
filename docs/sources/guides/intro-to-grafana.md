+++
title = "Intro to Grafana"
description = "Introduction to Grafana"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
[menu.docs]
name = "Getting started"
identifier = "intro_to_grafana"
parent = "guides"
weight = 200
+++

# Intro to Grafana

This topic provides a high-level look at Grafana, the Grafana process, and Grafana features. It is a good place to start if you want to learn more about Grafana software. To jump right in and start seeing (fake) data in graphs, refer to [Getting started]({{ < relref "getting_started.md" > }}).


Grafana is open source visualization and analytics software. It allows you to query, visualize, alert on, and explore your metrics no matter where they are stored. In plain English, it provides you with tools to turn your time-series database (TSDB) data into beautiful graphs and visualizations.

## Grafana process

1. Install Grafana on your system or configure and run a Docker image.
1. Add a data source. (Repeat for each data source.)
1. Create a dashboard.
1. Add panels to the dashboard.

After creating a dashboard, there are many possible things you might do next. It all depends on your needs and your use case. 

For example, if you want to view weather data and statistics about your smart home, then you might create a playlist. If you are the administrator for a corporation and are managing Grafana for multiple teams, then you might need to set up provisioning and authentication.

The following sections provide an overview of things you might want to do with your Grafana database and links so you can learn more. For more guidance and ideas, check out the [Grafana Community forums](https://community.grafana.com/).

## Visualize

From heatmaps to histograms, graphs to geo maps, Grafana has visualization options to help you understand your data. 
Build dashboards with panels and queries

## Explore metrics

Explore your data through ad-hoc queries and dynamic drilldown. Split view and compare different time ranges, queries and data sources side by side.

## Explore logs

Experience the magic of switching from metrics to logs with preserved label filters. Quickly search through all your logs or streaming them live.

Works best with our Loki data source but support for more are coming very soon.

## Unify

Grafana allows you to display all your time-series data on a single "pane of glass" by using a dashboard to visualize data from one or more data sources. Mix different data sources in the same graph! You can specify a data source on a per-query basis. This works for even custom datasources.

Create dynamic & reusable dashboards with template variables that appear as dropdowns at the top of the dashboard.

## Alert

Seamlessly define alerts where it makes sense — while you’re in the data. Define thresholds visually, and get notified via Slack, PagerDuty, and more. Visually define alert rules for your most important metrics. Grafana will continuously evaluate and send notifications to systems like Slack, PagerDuty, VictorOps, OpsGenie.

## Extend

Discover hundreds of dashboards and plugins in the official library. Thanks to the passion and momentum of our community, new ones are added every week.
Plugins - https://grafana.com/grafana/plugins
Dashboards

## Collaborate

Bring everyone together, and share data and dashboards across teams. Grafana empowers users, and helps foster a data driven culture. Share a to dashboard or fullscreen panel. Automatically includes current time range and variables. Create a public or internal snapshots. Server side render API makes chat integration possible.

Add users, permissions, organizations

## Annotations

Annotate graphs with rich events from different data sources. Hover over events shows you the full event metadata and tags. Annotate graphs with rich events from different data sources. Hover over events shows you the full event metadata and tags.

## Authentication

LDAP, Google Auth, Grafana.com, Github. However your company handles auth, Grafana makes it work easily with your existing workflow.

## Configure Grafana

## Provisioning

## Templating

## Cloud hosted Grafana

## Enterprise