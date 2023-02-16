---
title: Grafana managed alerts
---

## Clustering

The current alerting system doesn't support high availability. Alert notifications are not deduplicated and load balancing is not supported between instances; for example, silences from one instance will not appear in the other.

## Alert evaluation

Grafana managed alerts are evaluated by the Grafana backend. Rule evaluations are scheduled, according to the alert rule configuration, and queries are evaluated by an engine that is part of core Grafana.

Alerting rules can only query backend data sources with alerting enabled:

- builtin or developed and maintained by grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
  `Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Data Explorer`
- any community backend data sources with alerting enabled (`backend` and `alerting` properties are set in the [plugin.json]({{< relref "../../developers/plugins/metadata/" >}}))

## Metrics from the alerting engine

The alerting engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../../setup-grafana/set-up-grafana-monitoring/" >}}). See also, [View alert rules and their current state]({{< relref "../../alerting/fundamentals/state-and-health/" >}}).

| Metric Name                                 | Type      | Description                                                                              |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `alerting.alerts`                           | gauge     | How many alerts by state                                                                 |
| `alerting.request_duration_seconds`         | histogram | Histogram of requests to the Alerting API                                                |
| `alerting.active_configurations`            | gauge     | The number of active, non default alertmanager configurations for grafana managed alerts |
| `alerting.rule_evaluations_total`           | counter   | The total number of rule evaluations                                                     |
| `alerting.rule_evaluation_failures_total`   | counter   | The total number of rule evaluation failures                                             |
| `alerting.rule_evaluation_duration_seconds` | summary   | The duration for a rule to execute                                                       |
| `alerting.rule_group_rules`                 | gauge     | The number of rules                                                                      |
