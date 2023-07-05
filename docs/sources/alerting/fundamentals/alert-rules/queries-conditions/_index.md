---
title: Queries and conditions
description: Introduction to queries and conditions
weight: 103
keywords:
  - grafana
  - alerting
  - queries
  - conditions
---

# Queries and conditions

In Grafana, queries play a vital role in fetching and transforming data from supported data sources, which include databases like MySQL and PostgreSQL, time series databases like Prometheus, InfluxDB and Graphite, and services like Elasticsearch, AWS CloudWatch, Azure Monitor and Google Cloud Monitoring.

For more information on supported data sources, see [Data sources]({{< relref "../../data-source-alerting.md" >}}).

The process of executing a query involves defining the data source, specifying the desired data to retrieve, and applying relevant filters or transformations. Query languages or syntaxes specific to the chosen data source are utilized for constructing these queries.

In Alerting, you define a query to get the data you want to measure and a condition that needs to be met before an alert rule fires.

An alert rule consists of one or more queries and expressions that select the data you want to measure.

For more information on queries and expressions, see [Query and transform data]({{< relref "../../../../panels-visualizations/query-transform-data" >}}).

## Data source queries

Queries in Grafana can be applied in various ways, depending on the data source and query language being used. Each data source’s query editor provides a customized user interface that helps you write queries that take advantage of its unique capabilities.

Because of the differences between query languages, each data source query editor looks and functions differently. Depending on your data source, the query editor might provide auto-completion features, metric names, variable suggestions, or a visual query-building interface.

Some common types of query components include:

**Metrics or data fields**: Specify the specific metrics or data fields you want to retrieve, such as CPU usage, network traffic, or sensor readings.

**Time range**: Define the time range for which you want to fetch data, such as the last hour, a specific day, or a custom time range.

**Filters**: Apply filters to narrow down the data based on specific criteria, such as filtering data by a specific tag, host, or application.

**Aggregations**: Perform aggregations on the data to calculate metrics like averages, sums, or counts over a given time period.

**Grouping**: Group the data by specific dimensions or tags to create aggregated views or breakdowns.

**Note**:

Grafana does not support alert queries with template variables. More information is available [here](https://community.grafana.com/t/template-variables-are-not-supported-in-alert-queries-while-setting-up-alert/2514).

## Expression queries

In Grafana, an expression is used to perform calculations, transformations, or aggregations on the data source queried data. It allows you to create custom metrics or modify existing metrics based on mathematical operations, functions, or logical expressions.

By leveraging expression queries, users can perform tasks such as calculating the percentage change between two values, applying functions like logarithmic or trigonometric functions, aggregating data over specific time ranges or dimensions, and implementing conditional logic to handle different scenarios.

In Alerting, you can only use expressions for Grafana-managed alert rules. For each expression, you can choose from the math, reduce, and resample expressions. These are called multi-dimensional rules, because they generate a separate alert for each series.

You can also use classic condition, which creates an alert rule that triggers a single alert when its condition is met. As a result, Grafana sends only a single alert even when alert conditions are met for multiple series.

**Note:**

Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

**Reduce**

Aggregates time series values in the selected time range into a single value.

**Math**

Performs free-form math functions/operations on time series and number data. Can be used to preprocess time series data or to define an alert condition for number data.

**Resample**

Realigns a time range to a new set of timestamps, this is useful when comparing time series data from different data sources where the timestamps would otherwise not align.

**Threshold**

Checks if any time series data matches the threshold condition.

The threshold expression allows you to compare two single values. It returns `0` when the condition is false and `1` if the condition is true. The following threshold functions are available:

- Is above (x > y)
- Is below (x < y)
- Is within range (x > y1 AND x < y2)
- Is outside range (x < y1 AND x > y2)

**Classic condition**

Checks if any time series data matches the alert condition.

**Note**:

Classic condition expression queries always produce one alert instance only, no matter how many time series meet the condition.
Classic conditions exist mainly for compatibility reasons and should be avoided if possible.

## Alert condition

An alert condition is the query or expression that determines whether the alert will fire or not depending on the value it yields. There can be only one condition which will determine the triggering of the alert.

After you have defined your queries and/or expressions, choose one of them as the alert rule condition.

When the queried data satisfies the defined condition, Grafana triggers the associated alert, which can be configured to send notifications through various channels like email, Slack, or PagerDuty. The notifications inform you about the condition being met, allowing you to take appropriate actions or investigate the underlying issue.

By default, the last expression added is used as the alert condition.
