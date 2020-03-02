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

This is the general process of running Grafana.

1. [Install Grafana on your system]({{ < relref "../installation/_index.md">}}) or [configure]({{ < relref "../installation/configure-docker.md">}}) and [run a Docker image]({{ < relref "../installation/docker.md">}}).
1. [Add a data source]({{ < relref "../features/datasources/add-a-data-source.md">}}). (Repeat for each [data source]({{ < relref "../features/datasources/data-sources.md">}}).)
1. Create a [dashboard]({{ < relref "../features/dashboard/dashboards.md">}}).
1. Add [panels]({{ < relref "../features/panels/panels.md">}}) to the dashboard.

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

Grafana allows you to display all your time-series data on a single "pane of glass" by using a dashboard to visualize data from one or more data sources. Mix different data sources in the same graph! You can specify a data source on a per-query basis. This works for even custom data sources.

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

Grafana supports different authentication styles, such as LDAP and OAuth, and allows you to map users to organizations. Refer to the [User authentication overview]({{ < relref "../auth/overview.md">}}) for more information.

In Grafana Enterprise, you can also map users to teams: If your company has its own authentication system, Grafana allows you to map the teams in your internal systems to teams in Grafana. That way, you can automatically give people access to the dashboards designated for their teams. Refer to [Grafana Enterprise]({{ < relref "../enterprise/_index.md">}}) for more information.

## Configure Grafana

## Provisioning

## Templating



## Grafana Cloud

Grafana Cloud is a highly available, fast, fully managed OpenSaaS logging and metrics platform. Everything you love about Grafana, but Grafana Labs hosts it for you and handles all the headaches.

[Learn more about Grafana Cloud](https://grafana.com/cloud/).

## Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana, Grafana Enterprise adds enterprise data sources, advanced authentication options, more permission controls, 24x7x365 support, and training from the core Grafana team.

[Learn more about Grafana Enterprise](https://grafana.com/enterprise). To purchase Enterprise or obtain a trial license, contact the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).
