+++
title = "Alertmanager"
aliases = ["/docs/grafana/latest/alerting/metrics/"]
weight = 116
+++

# Alertmanager

Prometheus Alertmanager helps in grouping and managing rules, which adds a layer of orchestration on top of the alerting engines. To learn more, see [Prometheus Alertmanager documentation](https://prometheus.io/docs/alerting/latest/alertmanager/).

Grafana includes built-in support for Prometheus Alertmanager. By default, notifications for Grafana managed alerts are handled by the embedded Alertmanager that is part of core Grafana. You can configure its contact points, notification policies, silences, and templates from the alerting UI by selecting the `Grafana` option from the Alertmanager drop down.

> **Note:** Before v8.2, the configuration of the embedded Alertmanager was shared across organizations. If you are on an older Grafana version, we recommend that you use Grafana 8 Alerts only if you have one organization. Otherwise, your contact points are visible to all organizations.

Grafana 8 alerting added support for external Alertmanager configuration. When you add an [Alertmanager data source]({{< relref "../../../datasources/alertmanager.md" >}}), the Alertmanager drop down shows a list of available external Alertmanager data sources. Select a data source to create and manage alerting for standalone Cortex or Loki data sources.

{{< figure max-width="40%" src="/static/img/docs/alerting/unified/contact-points-select-am-8-0.gif" max-width="250px" caption="Select Alertmanager" >}}

## Evaluating Grafana managed alerts

Grafana managed alerts query backend data sources which has alerting enabled:

- built-in data sources or those developed and maintained by Grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
  `Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, and `Azure Monitor`
- community developed backend data sources with alerting enabled (`backend` and `alerting` properties are set in the [plugin.json]({{< relref "../../../developers/plugins/metadata.md" >}}))

### Metrics from the alerting engine

The alerting engine publishes some internal metrics about itself. You can read more about how Grafana publishes [internal metrics]({{< relref "../../../administration/view-server/internal-metrics.md" >}}). See also, [View alert rules and their current state]({{< relref "../alerting-rules/rule-list.md" >}}).

| Metric Name                                       | Type      | Description                                                                              |
| ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `grafana_alerting_alerts`                         | gauge     | How many alerts by state                                                                 |
| `grafana_alerting_request_duration`               | histogram | Histogram of requests to the Alerting API                                                |
| `grafana_alerting_active_configurations`          | gauge     | The number of active, non default Alertmanager configurations for grafana managed alerts |
| `grafana_alerting_rule_evaluations_total`         | counter   | The total number of rule evaluations                                                     |
| `grafana_alerting_rule_evaluation_failures_total` | counter   | The total number of rule evaluation failures                                             |
| `grafana_alerting_rule_evaluation_duration`       | summary   | The duration for a rule to execute                                                       |
| `grafana_alerting_rule_group_rules`               | gauge     | The number of rules                                                                      |
