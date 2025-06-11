---
aliases:
  - guides/what-is-grafana/
  - oss-details/
description: Learn about Grafana OSS, Grafana Enterprise, and Grafana Cloud.
labels:
  products:
    - cloud
    - enterprise
    - oss
title: About Grafana
weight: 5
---

# About Grafana

[Grafana open source software](/oss/) enables you to query, visualize, alert on, and explore your metrics, logs, and traces wherever they are stored. Grafana OSS provides you with tools to turn your time-series database (TSDB) data into insightful graphs and visualizations. The Grafana OSS plugin framework also enables you to connect other data sources like NoSQL/SQL databases, ticketing tools like Jira or ServiceNow, and CI/CD tooling like GitLab.

After you have [installed Grafana](../setup-grafana/installation/) and set up your first dashboard using instructions in [Getting started with Grafana](../getting-started/build-first-dashboard/), you will have many options to choose from depending on your requirements. For example, if you want to view weather data and statistics about your smart home, then you can create a [playlist](../dashboards/create-manage-playlists/). If you are the administrator for an enterprise and are managing Grafana for multiple teams, then you can set up [provisioning](../administration/provisioning/) and [authentication](../setup-grafana/configure-security/configure-authentication/).

The following sections provide an overview of Grafana features and links to product documentation to help you learn more. For more guidance and ideas, check out our [Grafana Community forums](https://community.grafana.com/).

## Explore metrics, logs, and traces

Explore your data through ad-hoc queries and dynamic drilldown. Split view and compare different time ranges, queries and data sources side by side. Refer to [Explore](../explore/) for more information.

## Alerts

If you're using Grafana Alerting, then you can have alerts sent through a number of different alert notifiers, including PagerDuty, SMS, email, VictorOps, OpsGenie, or Slack.

Alert hooks allow you to create different notifiers with a bit of code if you prefer some other channels of communication. Visually define [alert rules](../alerting/alerting-rules/) for your most important metrics.

## Annotations

Annotate graphs with rich events from different data sources. Hover over events to see the full event metadata and tags.

This feature, which shows up as a graph marker in Grafana, is useful for correlating data in case something goes wrong. You can create the annotations manually—just control-click on a graph and input some text—or you can fetch data from any data source. Refer to [Annotations](../dashboards/build-dashboards/annotate-visualizations/) for more information.

## Dashboard variables

[Template variables](../dashboards/variables/) allow you to create dashboards that can be reused for lots of different use cases. Values aren't hard-coded with these templates, so for instance, if you have a production server and a test server, you can use the same dashboard for both.

Templating allows you to drill down into your data, say, from all data to North America data, down to Texas data, and beyond. You can also share these dashboards across teams within your organization—or if you create a great dashboard template for a popular data source, you can contribute it to the whole community to customize and use.

## Configure Grafana

If you're a Grafana administrator, then you'll want to thoroughly familiarize yourself with [Grafana configuration options](../setup-grafana/configure-grafana/) and the [Grafana CLI](../cli/).

Configuration covers both config files and environment variables. You can set up default ports, logging levels, email IP addresses, security, and more.

## Import dashboards and plugins

Discover hundreds of [dashboards](/grafana/dashboards) and [plugins](/grafana/plugins) in the official library. Thanks to the passion and momentum of community members, new ones are added every week.

## Authentication

Grafana supports different authentication methods, such as LDAP and OAuth, and allows you to map users to organizations. Refer to the [User authentication overview](../setup-grafana/configure-security/configure-authentication/) for more information.

In Grafana Enterprise, you can also map users to teams: If your company has its own authentication system, Grafana allows you to map the teams in your internal systems to teams in Grafana. That way, you can automatically give people access to the dashboards designated for their teams. Refer to [Grafana Enterprise](grafana-enterprise/) for more information.

## Provisioning

While it's easy to click, drag, and drop to create a single dashboard, power users in need of many dashboards will want to automate the setup with a script. You can script anything in Grafana.

For example, if you're spinning up a new Kubernetes cluster, you can also spin up a Grafana automatically with a script that would have the right server, IP address, and data sources preset and locked in so users cannot change them. It's also a way of getting control over a lot of dashboards. Refer to [Provisioning](../administration/provisioning/) for more information.

## Permissions

When organizations have one Grafana and multiple teams, they often want the ability to both keep things separate and share dashboards. You can create a team of users and then set permissions on [folders and dashboards](../administration/user-management/manage-dashboard-permissions/), and down to the [data source level](../administration/data-source-management/#data-source-permissions) if you're using [Grafana Enterprise](grafana-enterprise/).

## Other Grafana Labs OSS Projects

In addition to Grafana, Grafana Labs also provides the following open source projects:

**Grafana Loki:** Grafana Loki is an open source, set of components that can be composed into a fully featured logging stack. For more information, refer to [Grafana Loki documentation](/docs/loki/latest/).

**Grafana Tempo:** Grafana Tempo is an open source, easy-to-use and high-volume distributed tracing backend. For more information, refer to [Grafana Tempo documentation](/docs/tempo/latest/?pg=oss-tempo&plcmt=hero-txt/).

**Grafana Mimir:** Grafana Mimir is an open source software project that provides a scalable long-term storage for Prometheus. For more information about Grafana Mimir, refer to [Grafana Mimir documentation](/docs/mimir/latest/).

**Grafana Pyroscope:** Grafana Pyroscope is an open source software project for aggregating continuous profiling data. Continuous profiling is an observability signal that allows you to understand your workload's resources (CPU, memory, for example) usage down to the line number. For more information about Grafana Pyroscope, refer to [Grafana Pyroscope documentation](/docs/pyroscope/latest/).

**Grafana Faro:** Grafana Faro is an open source JavaScript agent that embeds in web applications to collect real user monitoring (RUM) data: performance metrics, logs, exceptions, events, and traces. For more information about using Grafana Faro, refer to [Grafana Faro documentation](/docs/grafana-cloud/monitor-applications/frontend-observability/faro-web-sdk/).

**Grafana Beyla:** Grafana Beyla is an eBPF-based application auto-instrumentation tool for application observability. eBPF is used to automatically inspect application executables and the OS networking layer as well as capture basic trace spans related to web transactions and Rate-Errors-Duration (RED) metrics for Linux HTTP/S and gRPC services. All data capture occurs without any modifications to application code or configuration. For more information about Grafana Beyla, refer to [Grafana Beyla documentation](/docs/beyla/latest/).

**Grafana Alloy:** Grafana Alloy is a flexible, high performance, vendor-neutral distribution of the [OpenTelemetry](https://opentelemetry.io/) (OTel) Collector.
It's fully compatible with the most popular open source observability standards such as OpenTelemetry (OTel) and Prometheus.
For more information about Grafana Alloy, refer to the [Grafana Alloy documentation](https://grafana.com/docs/alloy/latest/).

**Grafana k6:** Grafana k6 is an open-source load testing tool that makes performance testing easy and productive for engineering teams. For more information about Grafana k6, refer to [Grafana k6 documentation](/docs/k6/latest/).

**Grafana OnCall:** Grafana OnCall is an open source incident response management tool built to help teams improve their collaboration and resolve incidents faster. For more information about Grafana OnCall, refer to [Grafana OnCall documentation](/docs/oncall/latest/).
