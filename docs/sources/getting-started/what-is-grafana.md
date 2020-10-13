+++
title = "What is Grafana?"
description = "Overview of Grafana and features"
keywords = ["grafana", "intro", "guide", "started"]
type = "docs"
[menu.docs]
aliases = ["/docs/grafana/latest/guides/what-is-grafana"]
name = "What is Grafana?"
identifier = "what_is_grafana"
parent = "guides"
weight = 200
+++

# What is Grafana?

This topic provides a high-level look at Grafana, the Grafana process, and Grafana features. It's a good place to start if you want to learn more about Grafana software. To jump right in, refer to [Getting started]({{< relref "getting-started.md" >}}).

Grafana is open source visualization and analytics software. It allows you to query, visualize, alert on, and explore your metrics no matter where they are stored. In plain English, it provides you with tools to turn your time-series database (TSDB) data into beautiful graphs and visualizations.

After creating a dashboard like you do in [Getting started]({{< relref "getting-started.md" >}}), there are many possible things you might do next. It all depends on your needs and your use case. 

For example, if you want to view weather data and statistics about your smart home, then you might create a playlist. If you are the administrator for a corporation and are managing Grafana for multiple teams, then you might need to set up provisioning and authentication.

The following sections provide an overview of things you might want to do with your Grafana database and links so you can learn more. For more guidance and ideas, check out the [Grafana Community forums](https://community.grafana.com/).

## Explore metrics and logs

Explore your data through ad-hoc queries and dynamic drilldown. Split view and compare different time ranges, queries and data sources side by side. 

Refer to [Explore]({{< relref "../explore/index.md" >}}) for more information.

## Alerts

If you're using Grafana alerting, then you can have alerts sent through a number of different [alert notifiers]({{< relref "../alerting/notifications.md" >}}), including PagerDuty, SMS, email, VictorOps, OpsGenie, or Slack. 

Alert hooks allow you to create different notifiers with a bit of code if you prefer some other channels of communication. Visually define [alert rules]({{< relref "../alerting/alerts-overview.md" >}}) for your most important metrics.

## Annotations

Annotate graphs with rich events from different data sources. Hover over events to see the full event metadata and tags.

This feature, which shows up as a graph marker in Grafana, is useful for correlating data in case something goes wrong. You can create the annotations manually—just control-click on a graph and input some text—or you can fetch data from any data source.

Refer to [Annotations]({{< relref "../dashboards/annotations.md" >}}) for more information.

## Dashboard variables

[Template variables]({{< relref "../variables/_index.md" >}}) allow you to create dashboards that can be reused for lots of different use cases. Values aren't hard-coded with these templates, so for instance, if you have a production server and a test server, you can use the same dashboard for both. 

Templating allows you to drill down into your data, say, from all data to North America data, down to Texas data, and beyond. You can also share these dashboards across teams within your organization—or if you create a great dashboard template for a popular data source, you can contribute it to the whole community to customize and use.

## Configure Grafana

If you're a Grafana administrator, then you'll want to thoroughly familiarize yourself with [Grafana configuration options]({{< relref "../administration/configuration.md" >}}) and the [Grafana CLI]({{< relref "../administration/cli.md" >}}).

Configuration covers both config files and environment variables. You can set up default ports, logging levels, email IP addresses, security, and more.

## Import dashboards and plugins

Discover hundreds of [dashboards](https://grafana.com/grafana/dashboards) and [plugins](https://grafana.com/grafana/plugins) in the official library. Thanks to the passion and momentum of community members, new ones are added every week.

## Authentication

Grafana supports different authentication methods, such as LDAP and OAuth, and allows you to map users to organizations. Refer to the [User authentication overview]({{< relref "../auth/overview.md" >}}) for more information.

In Grafana Enterprise, you can also map users to teams: If your company has its own authentication system, Grafana allows you to map the teams in your internal systems to teams in Grafana. That way, you can automatically give people access to the dashboards designated for their teams.

Refer to [Grafana Enterprise]({{< relref "../enterprise/_index.md" >}}) for more information.

## Provisioning

While it's easy to click, drag, and drop to create a single dashboard, power users in need of many dashboards will want to automate the setup with a script. You can script anything in Grafana. 

For example, if you're spinning up a new Kubernetes cluster, you can also spin up a Grafana automatically with a script that would have the right server, IP address, and data sources preset and locked in so users cannot change them. It's also a way of getting control over a lot of dashboards.

Refer to [Provisioning]({{< relref "../administration/provisioning.md" >}}) for more information.

## Permissions

When organizations have one Grafana and multiple teams, they often want the ability to both keep things separate and share dashboards. You can create a team of users and then set [permissions]({{< relref "../permissions/_index.md" >}}) on folders, dashboards, and down to the [data source level]({{< relref "../enterprise/datasource_permissions.md" >}}) if you're using [Grafana Enterprise]({{< relref "../enterprise/_index.md" >}}).

## Grafana Cloud

Grafana Cloud is a highly available, fast, fully managed OpenSaaS logging and metrics platform. Everything you love about Grafana, but Grafana Labs hosts it for you and handles all the headaches.

[Learn more about Grafana Cloud.](https://grafana.com/cloud/)

## Grafana Enterprise

[Grafana Enterprise]({{< relref "../enterprise/_index.md" >}}) is a commercial edition of Grafana that includes additional features not found in the open source version.

Building on everything you already know and love about Grafana, Grafana Enterprise adds enterprise data sources, advanced authentication options, more permission controls, 24x7x365 support, and training from the core Grafana team.

[Learn more about Grafana Enterprise](https://grafana.com/enterprise). To purchase Enterprise or obtain a trial license, contact the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).
