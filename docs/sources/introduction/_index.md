---
aliases:
  - guides/what-is-grafana/
  - oss-details/
description: Grafana is an open and composable observability platform for people and AI agents. Learn what Grafana is and how Grafana OSS, Grafana Enterprise, and Grafana Cloud differ.
labels:
  products:
    - cloud
    - enterprise
    - oss
title: About Grafana
weight: 5
---

# About Grafana

Grafana is an open and composable observability platform. It brings together metrics, logs, traces, profiles, and other data from across your organization and gives people and AI agents the context they need to monitor, understand, and act on that data.

You can run Grafana yourself with [Grafana OSS](/oss/) or [Grafana Enterprise](grafana-enterprise/), or use [Grafana Cloud](/docs/grafana-cloud/), the fully managed service, which includes a free tier. All three share the same core. Grafana queries your data where it's stored, through data sources that cover time-series databases, logging and tracing backends, SQL and NoSQL databases, and tools like Jira, ServiceNow, and GitLab. You can then visualize, alert on, and explore that data in one place, or work with it through [Grafana Assistant](../administration/assistant/) and the [Grafana MCP servers](/docs/grafana-cloud/ai-tools/mcp-servers/).

After you've [installed Grafana](../setup-grafana/installation/) and set up your first dashboard using instructions in [Getting started with Grafana](../getting-started/build-first-dashboard/), you will have many options to choose from depending on your requirements. For example, if you want to view weather data and statistics about your smart home, then you can create a [playlist](../dashboards/create-manage-playlists/). If you are the administrator for an enterprise and are managing Grafana for multiple teams, then you can set up [provisioning](../administration/provisioning/) and [authentication](../setup-grafana/configure-access/configure-authentication/).

The following sections provide an overview of Grafana features and links to product documentation to help you learn more. For more guidance and ideas, check out our [Grafana Community forums](https://community.grafana.com/).

## Explore metrics, logs, and traces

Explore your data through ad-hoc queries and dynamic drilldown. Split view and compare different time ranges, queries and data sources side by side. Refer to [Explore](../explore/) for more information.

## Alerts

If you're using Grafana Alerting, then you can have alerts sent through a number of different alert notifiers, including PagerDuty, SMS, email, VictorOps, OpsGenie, or Slack.

Alert hooks allow you to create different notifiers with a bit of code if you prefer some other channels of communication. Visually define [alert rules](../alerting/alerting-rules/) for your most important metrics.

## Annotations

Annotate graphs with rich events from different data sources. Hover over events to see the full event metadata and tags.

This feature, which shows up as a graph marker in Grafana, is useful for correlating data in case something goes wrong. You can create the annotations manually—just control-click on a graph and input some text—or you can fetch data from any data source. Refer to [Annotations](../dashboards/build-dashboards/annotate-visualizations/) for more information.

## Import dashboards and plugins

Discover hundreds of [dashboards](/grafana/dashboards) and [plugins](/grafana/plugins) in the official library. Thanks to the passion and momentum of community members, new ones are added every week.

## Dashboard variables

[Template variables](../dashboards/variables/) allow you to create dashboards that can be reused for lots of different use cases. Values aren't hard-coded with these templates, so for instance, if you have a production server and a test server, you can use the same dashboard for both.

Templating allows you to drill down into your data, say, from all data to North America data, down to Texas data, and beyond. You can also share these dashboards across teams within your organization—or if you create a great dashboard template for a popular data source, you can contribute it to the whole community to customize and use.

## Configure Grafana

If you're a Grafana administrator, then you'll want to thoroughly familiarize yourself with [Grafana configuration options](../setup-grafana/configure-grafana/) and the [Grafana CLI](../cli/).

Configuration covers both config files and environment variables. You can set up default ports, logging levels, email IP addresses, security, and more.

## Provisioning

While it's easy to click, drag, and drop to create a single dashboard, power users in need of many dashboards will want to automate the setup with a script. You can script anything in Grafana.

For example, if you're spinning up a new Kubernetes cluster, you can also spin up a Grafana automatically with a script that would have the right server, IP address, and data sources preset and locked in so users cannot change them. It's also a way of getting control over a lot of dashboards. Refer to [Provisioning](../administration/provisioning/) for more information.

## Authentication

Grafana supports different authentication methods, such as LDAP and OAuth, and allows you to map users to organizations. Refer to the [User authentication overview](../setup-grafana/configure-access/configure-authentication/) for more information.

In Grafana Enterprise, you can also map users to teams: If your company has its own authentication system, Grafana allows you to map the teams in your internal systems to teams in Grafana. That way, you can automatically give people access to the dashboards designated for their teams. Refer to [Grafana Enterprise](grafana-enterprise/) for more information.

## Permissions

When organizations have one Grafana stack and multiple teams, they often want the ability to both keep things separate and share dashboards. You can create a team of users and then set permissions on [folders and dashboards](../administration/user-management/manage-dashboard-permissions/), and down to the [data source level](../administration/data-source-management/#data-source-permissions) if you're using [Grafana Enterprise](grafana-enterprise/).

## AI and agents

Grafana includes the following AI capabilities for people and gives AI agents structured access to the platform.

- **Grafana Assistant:** An AI assistant built into Grafana that generates and explains queries, creates and edits dashboards, and navigates Grafana resources from natural language prompts. Assistant is available in Grafana Cloud and, starting in Grafana v13, in self managed Grafana OSS and Grafana Enterprise deployments connected to a Grafana Cloud stack. For more information, refer to [Grafana Assistant](../administration/assistant/) and the [Grafana Cloud Assistant documentation](/docs/grafana-cloud/platform/grafana-assistant/).
- **MCP servers:** Grafana provides [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers so that external AI agents and assistants can query and work with your Grafana data and resources. The [open source MCP server](/docs/grafana-cloud/ai-tools/mcp-servers/oss-mcp/) runs alongside any Grafana instance, and the [Cloud MCP Server](/docs/grafana-cloud/ai-tools/mcp-servers/cloud-mcp/) is hosted in Grafana Cloud. For more information, refer to [MCP servers](/docs/grafana-cloud/ai-tools/mcp-servers/).
- **LLM plugin:** The Grafana LLM app plugin centralizes access to large language model providers so that other Grafana features and plugins can use them without managing their own API keys. Refer to [LLM plugin](/docs/grafana-cloud/ai-tools/llm-plugin/).
- **Agent Observability and AI tools in Grafana Cloud:** Grafana Cloud adds [Agent Observability](/docs/grafana-cloud/observe-and-act/agent-observability/) for monitoring LLM agents in production, machine learning features such as forecasting, outlier detection, and Sift investigations, and the `gcx` CLI that gives AI coding agents access to your Grafana stack. For more information, refer to [AI tools](/docs/grafana-cloud/ai-tools/).

## Other Grafana Labs OSS Projects

The Grafana visualization layer is one of several open source projects that make up the platform. Grafana Labs also maintains the following databases that store each observability signal.

**Grafana Loki:** Grafana Loki is an open source set of components that can be composed into a fully featured logging stack. For more information, refer to [Grafana Loki documentation](/docs/loki/latest/).

**Grafana Tempo:** Grafana Tempo is an open source and high volume distributed tracing backend. For more information, refer to [Grafana Tempo documentation](/docs/tempo/latest/?pg=oss-tempo&plcmt=hero-txt/).

**Grafana Mimir:** Grafana Mimir is an open source software project that provides a scalable long term storage for Prometheus. For more information about Grafana Mimir, refer to [Grafana Mimir documentation](/docs/mimir/latest/).

**Grafana Pyroscope:** Grafana Pyroscope is an open source software project for aggregating continuous profiling data. Continuous profiling is an observability signal that allows you to understand your workload's resources (CPU, memory, for example) usage down to the line number. For more information about Grafana Pyroscope, refer to [Grafana Pyroscope documentation](/docs/pyroscope/latest/).

**Grafana Faro:** Grafana Faro is an open source JavaScript agent that embeds in web applications to collect real user monitoring (RUM) data: performance metrics, logs, exceptions, events, and traces. For more information about using Grafana Faro, refer to [Grafana Faro documentation](/docs/grafana-cloud/monitor-applications/frontend-observability/faro-web-sdk/).

**Grafana Beyla:** Grafana Beyla is an eBPF-based application auto-instrumentation tool for application observability. eBPF is used to automatically inspect application executables and the OS networking layer as well as capture basic trace spans related to web transactions and Rate-Errors-Duration (RED) metrics for Linux HTTP/S and gRPC services. All data capture occurs without any modifications to application code or configuration. For more information about Grafana Beyla, refer to [Grafana Beyla documentation](/docs/beyla/latest/).

**Grafana Alloy:** Grafana Alloy is a flexible, high performance, vendor-neutral distribution of the [OpenTelemetry](https://opentelemetry.io/) (OTel) Collector.
It's fully compatible with the most popular open source observability standards such as OpenTelemetry (OTel) and Prometheus.
For more information about Grafana Alloy, refer to the [Grafana Alloy documentation](https://grafana.com/docs/alloy/latest/).

**Grafana k6:** Grafana k6 is an open-source load testing tool that makes performance testing easy and productive for engineering teams. For more information about Grafana k6, refer to [Grafana k6 documentation](/docs/k6/latest/).

**Grafana OnCall:** Grafana OnCall is an open source incident response management tool built to help teams improve their collaboration and resolve incidents faster. For more information about Grafana OnCall, refer to [Grafana OnCall documentation](/docs/oncall/latest/).

## Get in touch and contribute

{{< docs/shared lookup="communicate.md" source="grafana" version="<GRAFANA_VERSION>" >}}

For more information, refer to [Contribute to Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/contribute).

## Frequently asked questions

{{< qa-list >}}
{{< qa question="What is Grafana and what is it used for?" >}}
Grafana is an open and composable observability platform.
It brings together metrics, logs, traces, profiles, and other data from across your organization and gives people and AI agents the context they need to monitor, understand, and act on that data.
It's used for infrastructure and application monitoring, observability, and operational dashboards.
Grafana queries data where it's stored, through a plugin framework that connects to many data sources, so you can visualize, alert on, and explore all of it in one place.
{{< /qa >}}
{{< qa question="Is Grafana open source and free to use?" >}}
Yes, Grafana is open source and free to use.
You can download Grafana OSS and self-host it at no cost.
Grafana Labs also offers two commercial editions built on the same core: Grafana Enterprise, a self-managed edition that adds enterprise features, plugins, and support; and Grafana Cloud, a fully managed service that includes a free tier.
You can start with Grafana OSS and move to Enterprise or Cloud as your needs grow.
{{< /qa >}}
{{< qa question="What's the difference between Grafana OSS, Grafana Enterprise, and Grafana Cloud?" >}}
Grafana OSS, Grafana Enterprise, and Grafana Cloud share the same Grafana core but differ in how they're hosted and what they include.
Grafana OSS is the free, self-managed open source edition that you run and maintain yourself.
Grafana Enterprise is also self-managed, but adds commercial features such as enterprise data source plugins, reporting, enhanced access control, and official support.
Grafana Cloud is the fully managed Grafana observability platform, hosted by Grafana Labs, with managed backends for metrics, logs, traces, and profiles and a free tier, so you don't have to run the stack yourself.
{{< /qa >}}
{{< qa question="Does Grafana include AI capabilities?" >}}
Yes.
Grafana Assistant is an AI assistant built into Grafana that generates queries, creates and edits dashboards, and navigates Grafana resources from natural language prompts. It's available in Grafana Cloud and, starting in Grafana v13, in self managed Grafana OSS and Grafana Enterprise.
Grafana also provides Model Context Protocol (MCP) servers, an [open source MCP server](/docs/grafana-cloud/ai-tools/mcp-servers/oss-mcp/) that you run yourself and a hosted [Cloud MCP Server](/docs/grafana-cloud/ai-tools/mcp-servers/cloud-mcp/), so AI agents can work with your Grafana data.
Grafana Cloud adds [Agent Observability](/docs/grafana-cloud/observe-and-act/agent-observability/) for monitoring LLM agents in production, and machine learning features such as forecasting, outlier detection, and Sift investigations.
Refer to [AI and agents](#ai-and-agents) for details.
{{< /qa >}}
{{< /qa-list >}}
