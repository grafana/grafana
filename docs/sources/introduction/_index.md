---
aliases:
  - guides/what-is-grafana/
  - oss-details/
title: Introduction to Grafana
weight: 5
---

# Grafana OSS

[Grafana open source software](https://grafana.com/oss/) enables you to query, visualize, alert on, and explore your metrics, logs, and traces wherever they are stored. Grafana OSS provides you with tools to turn your time-series database (TSDB) data into insightful graphs and visualizations. The Grafana OSS plugin framework also enables you to connect other data sources like NoSQL/SQL databases, ticketing tools like Jira or ServiceNow, and CI/CD tooling like GitLab.

After you have [installed Grafana]({{< relref "../setup-grafana/installation/" >}}) and set up your first dashboard using instructions in [Getting started with Grafana]({{< relref "../getting-started/build-first-dashboard.md" >}}), you will have many options to choose from depending on your requirements. For example, if you want to view weather data and statistics about your smart home, then you can create a [playlist]({{< relref "../dashboards/create-manage-playlists/" >}}). If you are the administrator for an enterprise and are managing Grafana for multiple teams, then you can set up [provisioning]({{< relref "../administration/provisioning/" >}}) and [authentication]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}}).

The following sections provide an overview of Grafana features and links to product documentation to help you learn more. For more guidance and ideas, check out our [Grafana Community forums](https://community.grafana.com/).

## Explore metrics, logs, and traces

Explore your data through ad-hoc queries and dynamic drilldown. Split view and compare different time ranges, queries and data sources side by side. Refer to [Explore]({{< relref "../explore/" >}}) for more information.

## Alerts

If you're using Grafana Alerting, then you can have alerts sent through a number of different alert notifiers, including PagerDuty, SMS, email, VictorOps, OpsGenie, or Slack.

Alert hooks allow you to create different notifiers with a bit of code if you prefer some other channels of communication. Visually define [alert rules]({{< relref "../alerting/alerting-rules/" >}}) for your most important metrics.

## Annotations

Annotate graphs with rich events from different data sources. Hover over events to see the full event metadata and tags.

This feature, which shows up as a graph marker in Grafana, is useful for correlating data in case something goes wrong. You can create the annotations manually—just control-click on a graph and input some text—or you can fetch data from any data source. Refer to [Annotations]({{< relref "../dashboards/build-dashboards/annotate-visualizations" >}}) for more information.

## Dashboard variables

[Template variables]({{< relref "../dashboards/variables" >}}) allow you to create dashboards that can be reused for lots of different use cases. Values aren't hard-coded with these templates, so for instance, if you have a production server and a test server, you can use the same dashboard for both.

Templating allows you to drill down into your data, say, from all data to North America data, down to Texas data, and beyond. You can also share these dashboards across teams within your organization—or if you create a great dashboard template for a popular data source, you can contribute it to the whole community to customize and use.

## Configure Grafana

If you're a Grafana administrator, then you'll want to thoroughly familiarize yourself with [Grafana configuration options]({{< relref "../setup-grafana/configure-grafana/" >}}) and the [Grafana CLI]({{< relref "../cli.md" >}}).

Configuration covers both config files and environment variables. You can set up default ports, logging levels, email IP addresses, security, and more.

## Import dashboards and plugins

Discover hundreds of [dashboards](https://grafana.com/grafana/dashboards) and [plugins](https://grafana.com/grafana/plugins) in the official library. Thanks to the passion and momentum of community members, new ones are added every week.

## Authentication

Grafana supports different authentication methods, such as LDAP and OAuth, and allows you to map users to organizations. Refer to the [User authentication overview]({{< relref "../setup-grafana/configure-security/configure-authentication/" >}}) for more information.

In Grafana Enterprise, you can also map users to teams: If your company has its own authentication system, Grafana allows you to map the teams in your internal systems to teams in Grafana. That way, you can automatically give people access to the dashboards designated for their teams. Refer to [Grafana Enterprise]({{< relref "./grafana-enterprise" >}}) for more information.

## Provisioning

While it's easy to click, drag, and drop to create a single dashboard, power users in need of many dashboards will want to automate the setup with a script. You can script anything in Grafana.

For example, if you're spinning up a new Kubernetes cluster, you can also spin up a Grafana automatically with a script that would have the right server, IP address, and data sources preset and locked in so users cannot change them. It's also a way of getting control over a lot of dashboards. Refer to [Provisioning]({{< relref "../administration/provisioning/" >}}) for more information.

## Permissions

When organizations have one Grafana and multiple teams, they often want the ability to both keep things separate and share dashboards. You can create a team of users and then set permissions on [folders and dashboards]({{< relref "../administration/user-management/manage-dashboard-permissions/" >}}), and down to the [data source level]({{< relref "../administration/data-source-management#data-source-permissions" >}}) if you're using [Grafana Enterprise]({{< relref "./grafana-enterprise" >}}).

## Other Grafana Labs OSS Projects

In addition to Grafana, Grafana Labs also provides the following open source projects:

**Grafana Loki:** Grafana Loki is an open source, set of components that can be composed into a fully featured logging stack. For more information, refer to [Grafana Loki documentation](https://grafana.com/docs/loki/latest/).

**Grafana Tempo:** Grafana Tempo is an open source, easy-to-use and high-volume distributed tracing backend. For more information, refer to [Grafana Tempo documentation](https://grafana.com/docs/tempo/latest/?pg=oss-tempo&plcmt=hero-txt/).

**Grafana Mimir:** Grafana Mimir is an open source software project that provides a scalable long-term storage for Prometheus. For more information about Grafana Mimir, refer to [Grafana Mimir documentation](https://grafana.com/docs/mimir/latest/).

**Grafana Phlare:** Grafana Phlare is an open-source software project for aggregating continuous profiling data. Continuous profiling is an observability signal that enables you to understand your workload's resource (CPU, memory, etc.) usage to the exact line number. For more information about using Grafana Phlare, refer to [Grafana Phlare documentation](https://grafana.com/docs/phlare/latest/).
