---
aliases:
  - ../fundamentals/data-source-alerting/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/data-source-alerting/
  - ../fundamentals/alert-rules/alert-instances/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/alert-instances/
  - ../fundamentals/alert-rules/organising-alerts/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/organising-alerts/
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
refs:
  queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#data-source-queries
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#data-source-queries
  alert-condition:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#alert-condition
  recorded-queries:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/recorded-queries/
  notification-images:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/images-in-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/images-in-notifications/
  notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/
  create-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/
  expression-queries:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#advanced-options-expressions
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/queries-conditions/#advanced-options-expressions
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/rule-evaluation/
---

# Alert rules

An alert rule is a set of evaluation criteria for when an alert rule should fire. An alert rule consists of:

- [Queries](ref:queries) that select the data set to evaluate.
- An [alert condition](ref:alert-condition) (the threshold) that the query must meet or exceed to trigger the alert instance.
- An interval that specifies the frequency of [alert rule evaluation](ref:alert-rule-evaluation) and a duration indicating how long the condition must be met to trigger the alert instance.
- Other customizable options, for example, setting what should happen in the absence of data, notification messages, and more.

Grafana supports two different alert rule types: Grafana-managed alert rules and data source-managed alert rules.

## Grafana-managed alert rules

Grafana-managed alert rules are the most flexible alert rule type. They allow you to create alert rules that can act on data from any of the [supported data sources](#supported-data-sources), and use multiple data sources in a single alert rule.

{{< figure src="/media/docs/alerting/grafana-managed-alerting-architecture.png" max-width="750px" caption="How Grafana-managed alerting works by default" >}}

1. Alert rules are created within Grafana and query one or more data sources.
1. Alert rules are evaluated by the Alert Rule Evaluation Engine from within Grafana.
1. Firing and resolved alert instances are forwarded to [handle their notifications](ref:notifications).

### Supported data sources

Grafana-managed alert rules can query backend data sources if Grafana Alerting is enabled by specifying `{"backend": true, "alerting": true}` in the `plugin.json` file.

Find the public data sources supporting Alerting in the [Grafana Plugins directory](/grafana/plugins/data-source-plugins/?features=alerting).

## Data source-managed alert rules

Data source-managed alert rules can query Prometheus-based data sources, such as Grafana Mimir or Grafana Loki. Alert rules are stored within the data source when the Ruler API is enabled (e.g., [Mimir Ruler API](/docs/mimir/<GRAFANA_VERSION>/references/http-api/#ruler) or [Loki Ruler API](/docs/loki/<GRAFANA_VERSION>/api/#ruler)).

In this setup, the distributed architecture can provide high-availability and fault tolerance.

{{< figure src="/media/docs/alerting/mimir-managed-alerting-architecture-v2.png" max-width="750px" caption="Mimir-managed alerting architecture" >}}

1. Alert rules are created and stored within the data source itself.
1. Alert rules can only query Prometheus-based data.
1. Alert rules are evaluated by the Alert Rule Evaluation Engine.
1. Firing and resolved alert instances are forwarded to [handle their notifications](ref:notifications).

## Recording rules

A recording rule pre-compute frequently used or computationally expensive queries, and saves the results as a new time series metric.

The new metric can then be used in alert rules and dashboards to optimize their queries.

Similar to alert rules, recording rules are evaluated periodically. For more details, refer to [Create recording rules](ref:create-recording-rules).

## Comparison between alert rule types

When choosing which alert rule type to use, consider the following comparison between Grafana-managed and data source-managed alert rules.

| <div style="width:200px">Feature</div>                                                                                  | <div style="width:200px">Grafana-managed alert rule</div>                                                                    | <div style="width:200px">Data source-managed alert rule                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create alert rules<wbr /> that query [data sources supporting Alerting](#supported-data-sources)                        | Yes                                                                                                                          | No. Only query Prometheus-based data sources.                                                                                                           |
| Mix and match data sources                                                                                              | Yes                                                                                                                          | No                                                                                                                                                      |
| Add [expressions](ref:expression-queries) to transform<wbr /> your data and set [alert conditions](ref:alert-condition) | Yes                                                                                                                          | No                                                                                                                                                      |
| Use [images in alert notifications](ref:notification-images)                                                            | Yes                                                                                                                          | No                                                                                                                                                      |
| Support for [recording rules](#recording-rules)                                                                         | Yes                                                                                                                          | Yes                                                                                                                                                     |
| Organization                                                                                                            | Organize and manage access with folders                                                                                      | Use namespaces                                                                                                                                          |
| Scaling                                                                                                                 | More resource intensive, depend on the database, and are likely to suffer from transient errors. They only scale vertically. | Store alert rules within the data source itself and allow for “infinite” scaling. Generate and send alert notifications from the location of your data. |
| Alert rule evaluation and delivery                                                                                      | Alert rule evaluation and delivery is done from within Grafana, using an external Alertmanager; or both.                     | Alert rule evaluation and alert delivery is distributed, meaning there is no single point of failure.                                                   |
