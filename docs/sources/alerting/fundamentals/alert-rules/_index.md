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

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of:

- Queries and expressions that select the data set to evaluate.
- A condition (the threshold) that the query must meet or exceed to trigger the alert instance.
- An interval that specifies the frequency of [alert rule evaluation][alert-rule-evaluation] and a duration indicating how long the condition must be met to trigger the alert instance.
- Other customizable options, for example, setting what should happen in the absence of data, notification messages, and more.

Grafana supports two different alert rule types: Grafana-managed alert rules and data source-managed alert rules.

## Grafana-managed alert rules

Grafana-managed alert rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of the [supported data sources](#supported-data-sources), and use multiple data sources in a single alert rule.

Additionally, you can also add [expressions to transform your data][expression-queries], set custom alert conditions, and include [images in alert notifications][notification-images].

{{< figure src="/media/docs/alerting/grafana-managed-alerting-architecture.png" max-width="750px" caption="How Grafana-managed alerting works by default" >}}

1. Alert rules are created within Grafana based on one or more data sources.

1. Alert rules are evaluated by the Alert Rule Evaluation Engine from within Grafana.

1. Firing and resolved alert instances are delivered to the internal Grafana [Alertmanager][alert-manager] which handles notifications.

### Supported data sources

Grafana-managed alert rules can query backend data sources if Grafana Alerting is enabled by specifying `{"backend": true, "alerting": true}` in the [plugin.json](/developers/plugin-tools/reference-plugin-json).

Find the public data sources supporting Alerting in the [Grafana Plugins directory](/grafana/plugins/data-source-plugins/?features=alerting).

## Data source-managed alert rules

Data source-managed alert rules can improve query performance via [recording rules](#recording-rules) and ensure high-availability and fault tolerance when implementing a distributed architecture.

They are only supported for Prometheus-based or Loki data sources with the Ruler API enabled. For more information, refer to the [Loki Ruler API](/docs/loki/<GRAFANA_VERSION>/api/#ruler) or [Mimir Ruler API](/docs/mimir/<GRAFANA_VERSION>/references/http-api/#ruler).

{{< figure src="/media/docs/alerting/mimir-managed-alerting-architecture-v2.png" max-width="750px" caption="Mimir-managed alerting architecture" >}}

1. Alert rules are created and stored within the data source itself.
1. Alert rules can only query Prometheus-based data. It can use either queries or [recording rules](#recording-rules).
1. Alert rules are evaluated by the Alert Rule Evaluation Engine.
1. Firing and resolved alert instances are delivered to the configured [Alertmanager][alert-manager] which handles notifications.

### Recording rules

A recording rule allows you to pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query computationally expensive expressions repeatedly.

Querying this new time series is faster, especially for dashboards since they query the same expression every time the dashboards refresh. For more information, refer to [Create recording rules][create-recording-rules].

Alternatively, Grafana Enterprise and Grafana Cloud offer [recorded queries][recorded-queries] that can be executed against any data source.

## Comparison between alert rule types

When choosing which alert rule type to use, consider the following comparison between Grafana-managed and data source-managed alert rules.

| <div style="width:200px">Feature</div>                                                                                | <div style="width:200px">Grafana-managed alert rule</div>                                                  | <div style="width:200px">Data source-managed alert rule                                                      |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Create alert rules<wbr /> based any [supported data sources](#supported-data-sources)                                 | Yes                                                                                                        | No. Only Prometheus-based or Loki data sources.                                                              |
| Mix and match data sources                                                                                            | Yes                                                                                                        | No                                                                                                           |
| Add [expressions][expression-queries] to transform<wbr /> queried data and set alert conditions                       | Yes                                                                                                        | No                                                                                                           |
| Use [images in alert notifications][notification-images]                                                              | Yes                                                                                                        | No                                                                                                           |
| Create [recording rules](#recording-rules)                                                                            | No                                                                                                         | Yes                                                                                                          |
| Support for [inhibition rules](https://prometheus.io/docs/alerting/latest/configuration/#inhibition-related-settings) | No                                                                                                         | Yes                                                                                                          |
| Alert rule storage and evaluation                                                                                     | Within Grafana                                                                                             | Within the data source                                                                                       |
| Alert delivery                                                                                                        | Alerts are sent to either the [Grafana Alertmanager or an external Alertmanager][alert-manager].           | Alerts from the data source are sent to the Alertmanager configured in the data source.                      |
| Scalability                                                                                                           | More resource-intensive as it depends on the Grafana instance and its database. It only scales vertically. | Evaluate and generate alerts from the data source. A distributed architecture allows for horizontal scaling. |

{{% docs/reference %}}

[alert-manager]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/alertmanager"
[alert-manager]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/alertmanager"

[create-recording-rules]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"
[create-recording-rules]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-mimir-loki-managed-recording-rule"

[alert-rule-evaluation]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation"
[alert-rule-evaluation]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation"

[expression-queries]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions#expression-queries"
[expression-queries]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions#expression-queries"

[queries-and-conditions]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions"
[queries-and-conditions]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions"

[notification-images]: "/docs/grafana/ -> /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications"
[notification-images]: "/docs/grafana-cloud/ -> /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/images-in-notifications"

[recorded-queries]: "/docs/ -> /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries"

{{% /docs/reference %}}
