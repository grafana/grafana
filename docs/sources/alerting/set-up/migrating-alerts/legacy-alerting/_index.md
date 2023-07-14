---
aliases:
  - /docs/grafana-cloud/alerts/
  - /docs/grafana-cloud/how-do-i/alerts/
  - /docs/grafana-cloud/legacy-alerting/
  - alerting/migrating-alerts/legacy-alerting/
description: Legacy alerting
title: Legacy alerting
weight: 110
---

# Legacy alerting

**Note:**

Starting with Grafana v9.0.0, legacy alerting is deprecated. It is no longer actively maintained or supported by Grafana and will be removed in Grafana v11.0.0.

You have two options to configure alerts within the Grafana Cloud GUI and a third option that enables you to set Grafana Cloud Alerts using the command line.

- **Grafana alerts** are the same as in an on-prem instance of Grafana.
  These alerts are created from a graph panel within a Grafana dashboard.
  This is useful when you want to create a simple alert based on one metric from within a panel.
  It also has a much simpler learning curve when you are getting started.
- **Grafana Cloud alerts - GUI** are an implementation of Prometheus-style rules that enable you to query your Grafana Cloud Metrics and then set up Prometheus Alertmanager-style alerts based on those rules.
  This is useful when you want to create precise, PromQL-based rules or create alerts from across many metrics and logs being collected into your Grafana Cloud Metrics.
  This form of alerting is much more powerful and configurable, but that comes with some complexity.
- **Grafana Cloud alerts - CLI** use mimirtool to create and upload the same types of Prometheus-style recording and alerting rules definitions to your Grafana Cloud Metrics instance.
  Once created, you will also be able to view these rules from within the Grafana Cloud Alerting page in the GUI.
- **Synthetic Monitoring alerts** are built on Prometheus alerts, just like in Grafana Cloud alerting.
  You can configure synthetic monitoring alerts separately using the UI in synthetic monitoring.
  Another option to create alerts for synthetic monitoring checks is to simply use Grafana Cloud alerting.

## Using Grafana alerts in Grafana Cloud

Grafana alerts are dashboard panel-driven and can only be created using the Graph panel.
This style of alerting builds on top of the query defined for the graph visualization, so alerts and notifications are sent based on breaking some threshold in the associated panel.

This also means that there is a one-to-one relationship between a Grafana alert and a graph panel.
So although Grafana alerts can be viewed centrally, they can only be managed directly from the panel that they’re tied to.
As a result, Grafana alerting is best suited for smaller setups, where there are only a few individuals or teams responsible for a small set of dashboards and where there are few dependencies between the dashboards.

{{% admonition type="note" %}}
Most curated dashboards, such as those provided with an integration or with Synthetic Monitoring do not allow you to alert from panels.
This is to preserve the ability to upgrade these dashboards automatically when the integration or Synthetic Monitoring abilities are updated.
To create an editable copy that you can edit and alert from, click settings (the gear logo) within any dashboard and then click **Make Editable**.
The copy will not be upgraded when/if the curated dashboard receives an update.
This is one reason why Grafana Cloud Alerts may be considered a better option.
{{% /admonition %}}

### What makes Grafana alerts unique?

With Grafana alerts, alerts are limited to only graph panels within dashboards.
In addition:

- Alerts can be edited by both Editor and Admin roles
- Alerts are visual, with an associated alerting threshold line
- Alerts work with many non-Prometheus data sources, including Graphite
- Alert notifications can be routed to many external notifier systems, directly from Grafana
- Alerts are directly associated with a dashboard
- Alerts can be tested

## Using Grafana Cloud Alerts

Because the metrics you collect and send to Grafana Cloud are centrally stored in one large time-series database, Grafana Cloud Metrics, you can query across these metrics using [PromQL](https://prometheus.io/docs/prometheus/latest/querying/basics/) and build alerts directly around those metrics rather than around a panel.
You can also query across any logs you have sent using Loki.

Grafana Cloud Alerts are directly tied to metrics and log data.
They can be configured either through the UI or by uploading files containing Prometheus and Loki alert rules with mimirtool.

Grafana Cloud Alerting's Prometheus-style alerts are built by querying directly from the data source itself.
Because these alerts are based on the data, they are not tied to a single panel.
This makes it possible to evaluate and centrally manage alerts across several different Prometheus and Loki data source instances.

### What makes Grafana Cloud Alerts unique?

With Grafana Cloud Alerts, alerts are not limited to coming from a graph panel.
In addition, you can:

- Prevent alerts from being edited, except by users with accounts that are assigned Admin roles.
- Centrally manage and create alerts across many systems, teams, and dashboards.
  Alerts are not bound to just one system, team, or dashboard.
- Create alerts for both metric _and_ log data, based on Prometheus and Loki, respectively.
- Silence and mute alerts in bulk, even using a schedule, using the Alertmanager.
- Route alert notifications to [many external notifier systems](https://prometheus.io/docs/operating/integrations/#alertmanager-webhook-receiver) using Alertmanager configurations
- Dedupe alert notifications automatically.

### Grafana Cloud Alert configuration methods

In a traditional on-prem environment, Prometheus-style alert configuration is done through the combination of defining a [Prometheus configuration file](https://prometheus.io/docs/prometheus/latest/configuration/configuration/) and an [Alertmanager configuration file](https://prometheus.io/docs/alerting/latest/configuration/), which live close to the Prometheus server.
With Grafana Cloud, you can still use this setup as well as more flexible architectures.

- You can use `mimirtool` to upload your configuration files to be hosted and evaluated entirely in Grafana Cloud.
- You can manage both alerting rules and Alertmanager configurations directly through the UI.
  Configuration files are unnecessary with this setup.
- You can use both methods concurrently to manage the alerts.
  For example, updates made using the `mimirtool` are automatically updated and visible within the Grafana Cloud Alerting interface in minutes.
