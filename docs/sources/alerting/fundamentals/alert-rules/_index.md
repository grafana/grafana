---
aliases:
  - ../fundamentals/data-source-alerting/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/data-source-alerting/
  - ../fundamentals/alert-rules/alert-instances/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/alert-instances/
  - ../fundamentals/alert-rules/recording-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/recording-rules/
  - ../fundamentals/alert-rules/alert-rule-types/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/alert-rule-types/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/
description: Learn about alert rules
keywords:
  - grafana
  - alerting
  - rules
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert rules
weight: 100
---

# Alert rules

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of one or more [queries and expressions, a condition][queries-and-conditions], and the duration over which the condition needs to be met to start firing.

While queries and expressions select the data set to evaluate, a condition sets the threshold that an alert must meet or exceed to create an alert.

An interval specifies how frequently an [alert rule is evaluated][alert-rule-evaluation]. Duration, when configured, indicates how long a condition must be met. The alert rules can also define alerting behavior in the absence of data.

Grafana supports two different alert rule types: [Grafana-managed alert rules](#grafana-managed-alert-rules) and [Data source-managed alert rules](#data-source-managed-alert-rules).

## Grafana-managed alert rules

Grafana-managed alert rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources.

In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

The following diagram shows how Grafana-managed alerting works.

{{< figure src="/media/docs/alerting/grafana-managed-rule.png" max-width="750px" caption="Grafana-managed alerting" >}}

1. Alert rules are created within Grafana based on one or more data sources.

1. Alert rules are evaluated by the Alert Rule Evaluation Engine from within Grafana.

1. Alerts are delivered using the internal Grafana Alertmanager.

   Note that you can also configure alerts to be delivered using an external Alertmanager; or use both internal and external alertmanagers.

### Supported data sources

Grafana-managed alert rules can query the following backend data sources that have alerting enabled:

- Built-in data sources or those developed and maintained by Grafana: `Graphite`, `Prometheus`, `Loki`, `InfluxDB`, `Elasticsearch`,
  `Google Cloud Monitoring`, `Cloudwatch`, `Azure Monitor`, `MySQL`, `PostgreSQL`, `MSSQL`, `OpenTSDB`, `Oracle`, `TestData`, and `Azure Monitor`.
- Community data sources specifying `{"alerting": true, “backend”: true}` in the [plugin.json](https://grafana.com/developers/plugin-tools/reference-plugin-json)

### Multi-dimensional alerts

Grafana-managed alerting supports multi-dimensional alerting. Each alert rule can create multiple alert instances. This is exceptionally powerful if you are observing multiple series in a single expression.

Consider the following PromQL expression:

```promql
sum by(cpu) (
  rate(node_cpu_seconds_total{mode!="idle"}[1m])
)
```

A rule using this expression will create as many alert instances as the amount of CPUs we are observing after the first evaluation, allowing a single rule to report the status of each CPU.

{{< figure src="/static/img/docs/alerting/unified/multi-dimensional-alert.png" caption="A multi-dimensional Grafana managed alert rule" >}}

## Data source-managed alert rules

To create data source-managed alert rules, you must have a compatible Prometheus or Loki data source.

You can check if your data source supports rule creation via Grafana by testing the data source and observing if the Ruler API is supported.

For more information on the Ruler API, refer to [Ruler API](/docs/loki/latest/api/#ruler).

The following diagram shows how data source-managed alerting works.

{{< figure src="/media/docs/alerting/loki-mimir-rule.png" max-width="750px" caption="Grafana Mimir/Loki-managed alerting" >}}

1. Alert rules are created and stored within the data source itself.
1. Alert rules can only be created based on Prometheus data.
1. Alert rule evaluation and delivery is distributed across multiple nodes for high availability and fault tolerance.

### Recording rules

A recording rule allows you to pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query computationally expensive expressions repeatedly.

Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh.

Grafana Enterprise offers an alternative to recorded rules in the form of recorded queries that can be executed against any data source.

For more information on recording rules, refer to [Create recording rules][create-recording-rules].

## Comparison between alert rule types

When choosing which alert rule type to use, consider the following comparison between Grafana-managed and data source-managed alert rules.

| <div style="width:200px">Feature</div>                                         | <div style="width:200px">Grafana-managed alert rule</div>                                                                    | <div style="width:200px">Data source-managed alert rule                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create alert rules<wbr /> based on data from any of our supported data sources | Yes                                                                                                                          | No: You can only create alert rules that are based on Prometheus data. The data source must have the Ruler API enabled.                                 |
| Mix and match data sources                                                     | Yes                                                                                                                          | No                                                                                                                                                      |
| Includes support for recording rules                                           | No                                                                                                                           | Yes                                                                                                                                                     |
| Add expressions to transform<wbr /> your data and set alert conditions         | Yes                                                                                                                          | No                                                                                                                                                      |
| Use images in alert notifications                                              | Yes                                                                                                                          | No                                                                                                                                                      |
| Scaling                                                                        | More resource intensive, depend on the database, and are likely to suffer from transient errors. They only scale vertically. | Store alert rules within the data source itself and allow for “infinite” scaling. Generate and send alert notifications from the location of your data. |
| Alert rule evaluation and delivery                                             | Alert rule evaluation and delivery is done from within Grafana, using an external Alertmanager; or both.                     | Alert rule evaluation and alert delivery is distributed, meaning there is no single point of failure.                                                   |

**Note:**

If you are using non-Prometheus data, we recommend choosing Grafana-managed alert rules. Otherwise, choose Grafana Mimir or Grafana Loki alert rules where possible.

{{% docs/reference %}}

[create-recording-rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"
[create-recording-rules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"

[alert-rule-evaluation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation"
[alert-rule-evaluation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/rule-evaluation"

[queries-and-conditions]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions"
[queries-and-conditions]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions"

{{% /docs/reference %}}
