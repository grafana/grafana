+++
title = "Legacy Grafana Alerts"
weight = 114
+++

# Legacy Grafana alerts

Grafana 8.0 has [new and improved alerts]({{< relref "../unified-alerting/_index.md" >}}). The new alerting system are an opt-in feature that centralizes alerting information for Grafana managed alerts and alerts from Prometheus-compatible data sources in one UI and API.

Out of the box, Grafana still supports legacy dashboard alerts. Legacy Grafana alerts consists of two parts:

Alert rules - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
Notification channel - How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

Currently only the graph panel visualization supports alerts.

Legacy alerts have two main components:

- Alert rule - When the alert is triggered. Alert rules are defined by one or more conditions that are regularly evaluated by Grafana.
- Notification channel -  How the alert is delivered. When the conditions of an alert rule are met, the Grafana notifies the channels configured for that alert.

## Alert tasks

You can perform the following tasks for alerts:

- [Create an alert rule]({{< relref "create-alerts.md" >}})
- [View existing alert rules and their current state]({{< relref "view-alerts.md" >}})
- [Test alert rules and troubleshoot]({{< relref "troubleshoot-alerts.md" >}})
- [Add or edit an alert contact point]({{< relref "notifications.md" >}})

## Clustering

Currently alerting supports a limited form of high availability. Since v4.2.0 of Grafana, alert notifications are deduped when running multiple servers. This means all alerts are executed on every server but no duplicate alert notifications are sent due to the deduping logic. Proper load balancing of alerts will be introduced in the future.

## Alert evaluation

Grafana managed alerts are evaluated by the Grafana backend. Rule evaluations are scheduled, according to the alert rule configuration, and queries are evaluated by an engine that is part of core Grafana.

Alert rules can only query backend data sources with alerting enabled:
- builtin or developed and maintained by grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
`Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Data Explorer`
- any community backend data sources with alerting enabled (`backend` and `alerting` properties are set in the [plugin.json]({{< relref "../../developers/plugins/metadata.md" >}}))

## Metrics from the alert engine

The alert engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../../administration/view-server/internal-metrics.md" >}}).

Metric Name | Type | Description
---------- | ----------- | ----------
`alerting.alerts` | gauge | How many alerts by state
`alerting.request_duration_seconds` | histogram | Histogram of requests to the Alerting API
`alerting.active_configurations` | gauge | The number of active, non default alertmanager configurations for grafana managed alerts
`alerting.rule_evaluations_total` | counter | The total number of rule evaluations
`alerting.rule_evaluation_failures_total` | counter | The total number of rule evaluation failures
`alerting.rule_evaluation_duration_seconds` | summary | The duration for a rule to execute
`alerting.rule_group_rules` | gauge | The number of rules
