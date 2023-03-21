---
aliases:
  - metrics/
  - unified-alerting/fundamentals/
title: Explore Alerting
weight: 105
---

# Introduction to Alerting

Whether you’re starting or expanding your implementation of Grafana Alerting, learn more about the key concepts and available features that help you create, manage, and take action on your alerts and improve your team’s ability to resolve issues quickly.

First of all, let’s look at the different alert rule types that Grafana Alerting offers.

## Alert rule types

### Grafana-managed rules

Grafana-managed rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources.
In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions.
This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

### Mimir and Loki rules

To create Mimir or Loki alerts you must have a compatible Prometheus or Loki data source. You can check if your data source supports rule creation via Grafana by testing the data source and observing if the ruler API is supported.

### Recording rules

Recording rules are only available for compatible Prometheus or Loki data sources.
A recording rule allows you to pre-compute frequently needed or computationally expensive expressions and save their result as a new set of time series. This is useful if you want to run alerts on aggregated data or if you have dashboards that query computationally expensive expressions repeatedly.
Grafana Enterprise offers an alternative to recorded rules in the form of [recorded queries](https://grafana.com/docs/grafana/v9.0/enterprise/recorded-queries/) that can be executed against any data source.

## Key concepts and features

The following table includes a list of key concepts, features and their definitions, designed to help you make the most of Grafana Alerting.

| Key concept or feature    | Definition                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data sources for Alerting | Select data sources you want to query and visualize metrics, logs and traces from.                                                                                                                                                                                                     |
| Provisioning for Alerting | Manage your alerting resources and provision them into your Grafana system using file provisioning or Terraform.                                                                                                                                                                       |
| Scheduler                 | Evaluates your alert rules; think of it as the component that periodically runs your query against data sources. It is only applicable to Grafana-managed rules.                                                                                                                       |
| Alertmanager              | Manages the routing and grouping of alert instances.                                                                                                                                                                                                                                   |
| Alert rule                | A set of evaluation criteria for when an alert rule should fire. An alert rule consists of one or more queries and expressions, a condition, the frequency of evaluation, and the duration over which the condition is met. An alert rule can produce multiple alert instances.        |
| Alert instance            | An alert instance is created when an alert rule fires. An alert rule can create one or more alert instances. When multiple instances are created as a result of one alert rule, this is referred to as a multi-dimensional alert.                                                      |
| Alert group               | The Alertmanager groups alert instances by default using the labels for the root notification policy. This controls de-duplication and groups of alert instances which are sent to contact points.                                                                                     |
| Contact point             | Define how your contacts are notified when an alert rule fires.                                                                                                                                                                                                                        |
| Message templating        | Create reusable custom templates and use them in contact points.                                                                                                                                                                                                                       |
| Notification policy       | Set of rules for where, when, and how the alerts are grouped and routed to contact points.                                                                                                                                                                                             |
| Labels and label matchers | Labels uniquely identify alert rules. They link alert rules to notification policies and silences, determining which policy should handle them and which alert rules should be silenced.                                                                                               |
| Silences                  | Stop notifications from one or more alert instances. The difference between a silence and a mute timing is that a silence only lasts for only a specified window of time whereas a mute timing is meant to be recurring on a schedule. Uses label matchers to silence alert instances. |
| Mute timings              | Specify a time interval when you don’t want new notifications to be generated or sent. You can also freeze alert notifications for recurring periods of time, such as during a maintenance period. Must be linked to an existing notification policy.                                  |
