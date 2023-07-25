---
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/
description: Learn about the different alert rule types
keywords:
  - grafana
  - alerting
  - rule types
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Alert rule types
weight: 102
---

# Alert rule types

Grafana supports two different alert rule types. Learn more about each of the alert rule types, how they work, and decide which one is best for your use case.

## Grafana-managed alert rules

Grafana-managed alert rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources.

In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

The following diagram shows how Grafana-managed alerting works.

{{< figure src="/media/docs/alerting/grafana-managed-rule.png" max-width="750px" caption="Grafana-managed alerting" >}}

1. Alert rules are created within Grafana based on one or more data sources.

1. Alert rules are evaluated by the Alert Rule Evaluation Engine from within Grafana.

1. Alerts are delivered using the internal Grafana Alertmanager.

**Note:**

You can also configure alerts to be delivered using an external Alertmanager; or use both internal and external alertmanagers.
For more information, see Add an external Alertmanager.

## Data source-managed alert rules

To create data source-managed alert rules, you must have a compatible Prometheus or Loki data source.

You can check if your data source supports rule creation via Grafana by testing the data source and observing if the Ruler API is supported.

For more information on the Ruler API, refer to [Ruler API](/docs/loki/latest/api/#ruler).

The following diagram shows how data source-managed alerting works.

{{< figure src="/media/docs/alerting/loki-mimir-rule.png" max-width="750px" caption="Grafana Mimir/Loki-managed alerting" >}}

1. Alert rules are created and stored within the data source itself.
1. Alert rules can only be created based on Prometheus data.
1. Alert rule evaluation and delivery is distributed across multiple nodes for high availability and fault tolerance.

## Choose an alert rule type

When choosing which alert rule type to use, consider the following comparison between Grafana-managed alert rules and Grafana Mimir or Loki alert rules.

{{< responsive-table >}}
| <div style="width:200px">Feature</div> | <div style="width:200px">Grafana-managed alert rule</div> | <div style="width:200px">Loki/Mimir-managed alert rule |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create alert rules<wbr /> based on data from any of our supported data sources | Yes | No: You can only create alert rules that are based on Prometheus data. The data source must have the Ruler API enabled. |
| Mix and match data sources | Yes | No |
| Includes support for recording rules | No | Yes |
| Add expressions to transform<wbr /> your data and set alert conditions | Yes | No |
| Use images in alert notifications | Yes | No |
| Scaling | More resource intensive, depend on the database, and are likely to suffer from transient errors. They only scale vertically. | Store alert rules within the data source itself and allow for “infinite” scaling. Generate and send alert notifications from the location of your data. |
| Alert rule evaluation and delivery | Alert rule evaluation and delivery is done from within Grafana, using an external Alertmanager; or both. | Alert rule evaluation and alert delivery is distributed, meaning there is no single point of failure. |

{{< /responsive-table >}}

**Note:**

If you are using non-Prometheus data, we recommend choosing Grafana-managed alert rules. Otherwise, choose Grafana Mimir or Grafana Loki alert rules where possible.
