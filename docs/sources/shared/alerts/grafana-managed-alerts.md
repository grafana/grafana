---
labels:
  products:
    - enterprise
    - oss
title: Grafana managed alerts
---

## Clustering

The current alerting system doesn't support high availability. Alert notifications are not deduplicated and load balancing is not supported between instances; for example, silences from one instance will not appear in the other.

## Alert evaluation

Grafana managed alerts are evaluated by the Grafana backend. Rule evaluations are scheduled, according to the alert rule configuration, and queries are evaluated by an engine that is part of core Grafana.

Alerting rules can only query backend data sources with alerting enabled:

- builtin or developed and maintained by grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
  `Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Data Explorer`
- any community backend data sources with alerting enabled (`backend` and `alerting` properties are set in the [plugin.json](https://grafana.com/developers/plugin-tools/reference/plugin-json)

## Metrics from the alerting engine

The alerting engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics](/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-grafana-monitoring/). See also, [View alert rules and their current state](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/state-and-health/).

| Metric Name                                         | Type      | Description                                                                              |
| --------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `alerting.alerts`                                   | gauge     | How many alerts by state                                                                 |
| `alerting.request_duration_seconds`                 | histogram | Histogram of requests to the Alerting API                                                |
| `alerting.active_configurations`                    | gauge     | The number of active, non default alertmanager configurations for grafana managed alerts |
| `alerting.rule_evaluations_total`                   | counter   | The total number of rule evaluations                                                     |
| `alerting.rule_evaluation_failures_total`           | counter   | The total number of rule evaluation failures                                             |
| `alerting.rule_evaluation_duration_seconds`         | histogram | The time to evaluate a rule                                                              |
| `alerting.rule_process_evaluation_duration_seconds` | histogram | The time to process the evaluation results for a rule                                    |
| `alerting.rule_send_alerts_duration_seconds`        | histogram | The time to send the alerts to Alertmanager                                              |
| `alerting.rule_group_rules`                         | gauge     | The number of rules                                                                      |
| `alerting.state_calculation_duration_seconds`       | histogram | The duration of calculation of a single state                                            |
