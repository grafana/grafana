+++
title = "What's new in Grafana v8.2"
description = "Feature and improvement highlights for Grafana v8.2"
keywords = ["grafana", "new", "documentation", "8.2", "release notes"]
weight = -33
aliases = ["/docs/grafana/latest/guides/whats-new-in-v8-2/"]
[_build]
list = false
+++

# What’s new in Grafana v8.2

> **Note:** This topic will be updated frequently between now and the final release. Additionally, not all features listed here may be present in all the beta releases.

Grafana 8.2 continues to build on the foundation laid out in Grafana 8.0 & 8.1. We’ve continued to extend the GeoMap panel and bring new features to the Time Series panel. Grafana 8.2 also marks the start of our work to bring Grafana closer to all users with a focus on increasing Grafana’s accessibility, part of its continuing mission to democratize metrics _for everyone_.

We’ve summarized what’s new in the release here, but you might also be interested in the announcement blog post as well. If you’d like all the details you can checkout the complete [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

# OSS

## Accessibility

We’ve taken our first, measured but important steps towards improving the accessibility of Grafana, with much needed tweaks to keyboard navigation, accessibility labeling for UI elements for Grafana viewers and an accessibility statement (link coming soon) for Grafana laying out what you can expect from a Grafana focused on making our project accessible to all.

## Grafana 8 Alerting

We’ve continued to bolster the new, unified alerting system which we launched in Grafana 8. This release includes significant improvements including an AlertManager notification panel allowing users to explore alerts via a dashboard panel. We’ve also added custom grouping for alert manager notifications and a number of small but significant changes to improve creation editing and managing alert rules. Please see the [alerting documentation](https://grafana.com/docs/grafana/latest/alerting/unified-alerting/) for more details and information on enabling the unified alerting in your instance of Grafana.

{{< figure src="/static/img/docs/alerting/unified/alert-manager-panel-alpha.png" max-width="1200px" caption="Alert manager panel" >}}

## Panels

A number of new visualizations and features are included in Grafana 8.2 including the XY Chart, commonly called a Scatter plot.

### XY Chart [beta]

The XY Chart panel, aka. scatter panel, is available in beta form. This chart is all about first-class support for data where x does not equate to time.

{{< figure src="/static/img/docs/scatter-panel/scatter-placeholder.png" max-width="1200px" caption="Scatter Panel" >}}

# Grafana Enterprise

## Brand-new license and stats screen

We’ve revamped the Stats and License sections of Grafana for administrators. The new combined screen makes it easier to understand a license’s term and user counts, and find out early when you need to renew or expand a license. It’s also easier to parse Grafana statistics like the number of dashboards, data sources, and alerts in a given instance. This screen also includes an interactive list of dashboard and folder permissions, which can affect your users’ licensed roles in Grafana. Learn more about Grafana Enterprise on our [website](https://grafana.com/products/enterprise/grafana/), and more about licenses in particular in our [docs](https://grafana.com/docs/grafana/latest/enterprise/license/license-restrictions/).

{{< figure src="/static/img/docs/enterprise/8_2_stats_licensing_screen.png" max-width="1200px" caption="Stats and licensing" >}}

## New fine-grained access control permissions

Fine-grained access control now covers data source and provisioning permissions. You can decide which roles (Viewers, Editors, and Admins) can manage data sources and data source permissions in Grafana, and which roles can reload provisioning configuration for dashboards, data sources, and other provisioned resources. We’ll continue adding fine-grained access control to more Grafana services, like dashboards and API Keys, in upcoming releases. Learn more about fine-grained access control in our [release post](https://grafana.com/blog/2021/06/23/new-in-grafana-enterprise-8.0-fine-grained-access-control-for-reporting-and-user-management/) and our [docs](https://grafana.com/docs/grafana/latest/enterprise/access-control/).

{{< figure src="/static/img/docs/enterprise/8_2_data_source_permissions.png" max-width="1200px" caption="Stats and licensing" >}}

## Export usage insights logs as server logs

Usage Insights Logs contain valuable information about user dashboard visits, queries, and front-end errors that are otherwise impossible to track in Grafana. You can now export those logs alongside your regular server logs, in order to identify problematic dashboards and data sources and improve users’ experience with Grafana. Previously, these metrics could only be exported directly to Loki. Learn more in the [docs](https://grafana.com/docs/grafana/latest/enterprise/usage-insights/export-logs/)

{{< figure src="/static/img/docs/enterprise/8_2_export_usage_insights.png" max-width="1200px" caption="Stats and licensing" >}}

## Create a report from the dashboard Share dialogue

Reports are a powerful way to deliver insights directly to people’s email inboxes. Now you can create a report directly from any dashboard, using the Share button. This is especially useful combined with fine-grained access control, which you can use to grant Editors or Viewers the ability to create reports in Grafana. Learn more about Reporting in the [docs](​​https://grafana.com/docs/grafana/latest/enterprise/reporting/).

## Image Renderer performance improvements and measurement

You can use Grafana’s image renderer to generate JPEG and PDF images of panels and dashboards. These images are used for alert notifications, PDF exports, and reports sent by Grafana. We’ve added additional metrics to the image renderer to help you diagnose its performance, and included guidance in our documentation to help you configure it for the best mix of performance and resource usage. In our tests, we were able to reduce image load time from a 95th percentile of 10 seconds to less than 3 seconds under normal load.
