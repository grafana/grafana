+++
title = "Grafana 8 Alerts"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 113
+++

# Overview of Grafana 8 alerts

Grafana 8.0 has a new and improved alerting sub-system that centralizes alerting information for Grafana managed alerts and alerts from Prometheus-compatible data sources into one user interface and API.

> **Note:** Grafana 8 alerts is an [opt-in]({{< relref "../unified-alerting/opt-in.md" >}}) feature. Out of the box, Grafana still supports old [legacy dashboard alerts]({{< relref "../old-alerting/_index.md" >}}). We encourage you to create issues in the Grafana GitHub repository for bugs found while testing Grafana 8 alerts.

Grafana 8 alerts have four main components:

- Alerting rule - One or more query and/or expression, a condition, the frequency of evaluation, and the (optional) duration that a condition must be met before creating an alert.
- Contact point - A channel for sending notifications when the conditions of an alerting rule are met.
- Notification policy - A set of matching and grouping criteria used to determine where, and how frequently, to send notifications.
- Silences - Date and matching criteria used to silence notifications.

## Alerting tasks

You can perform the following tasks for alerts:

- [Create a Grafana managed alert rule]({{< relref "alerting-rules/create-grafana-managed-rule.md" >}})
- [Create a Cortex or Loki managed alert rule]({{< relref "alerting-rules/create-cortex-loki-managed-rule.md" >}})
- [View existing alert rules and their current state]({{< relref "alerting-rules/rule-list.md" >}})
- [View state and health of alerting rules]({{< relref "alerting-rules/state-and-health.md" >}})
- [Add or edit an alert contact point]({{< relref "./contact-points.md" >}})
- [Add or edit notification policies]({{< relref "./notification-policies.md" >}})
- [Create and edit silences]({{< relref "./silences.md" >}})

## Clustering

The current alerting system doesn't support high availability. Alert notifications are not deduplicated and load balancing is not supported between instances e.g. silences from one instance will not appear in the other. The Grafana team aims to have this feature by Grafana version 8.1+.

## Alert evaluation

Grafana managed alerts are evaluated by the Grafana backend. Rule evaluations are scheduled, according to the alert rule configuration, and queries are evaluated by an engine that is part of core Grafana.

Alerting rules can only query backend data sources with alerting enabled:

- builtin or developed and maintained by grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
  `Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Data Explorer`
- any community backend data sources with alerting enabled (`backend` and `alerting` properties are set in the [plugin.json]({{< relref "../../developers/plugins/metadata.md" >}}))

## Metrics from the alerting engine

The alerting engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../../administration/view-server/internal-metrics.md" >}}). See also, [View alert rules and their current state]({{< relref "alerting-rules/rule-list.md" >}}).

| Metric Name                                       | Type      | Description                                                                              |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `grafana_alerting_alerts`                         | gauge     | How many alerts by state                                                                 |
| `grafana_alerting_request_duration`               | histogram | Histogram of requests to the Alerting API                                                |
| `grafana_alerting_active_configurations`          | gauge     | The number of active, non default Alertmanager configurations for grafana managed alerts |
| `grafana_alerting_rule_evaluations_total`         | counter   | The total number of rule evaluations                                                     |
| `grafana_alerting_rule_evaluation_failures_total` | counter   | The total number of rule evaluation failures                                             |
| `grafana_alerting_rule_evaluation_duration`       | summary   | The duration for a rule to execute                                                       |
| `grafana_alerting_rule_group_rules`               | gauge     | The number of rules                                                                      |

## Limitation

Grafana 8 alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch rules from all other supported data sources at this time.
