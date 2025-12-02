---
aliases:
  - ../../../panels-visualizations/query-transform-data/ # /docs/grafana/next/panels-visualizations/query-transform-data/
  - ../../../panels-visualizations/query-transform-data/expression-queries/ # /docs/grafana/next/panels-visualizations/query-transform-data/expression-queries/
  - ../../../panels/query-a-data-source/use-expressions-to-manipulate-data/ # /docs/grafana/next/panels/query-a-data-source/use-expressions-to-manipulate-data/
  - ../../../panels/query-a-data-source/use-expressions-to-manipulate-data/about-expressions/ # /docs/grafana/next/panels/query-a-data-source/use-expressions-to-manipulate-data/about-expressions/
  - ../../../panels/query-a-data-source/use-expressions-to-manipulate-data/write-an-expression/ # /docs/grafana/next/panels/query-a-data-source/use-expressions-to-manipulate-data/write-an-expression/
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Expressions
title: Grafana expressions
description: Write server-side expressions to manipulate data using math and other operations
weight: 40
refs:
  no-data-and-error-handling:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/#configure-no-data-and-error-handling
  multiple-dimensional-data:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/
  grafana-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
  labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/#labels
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/timeseries-dimensions/#labels
---

# Grafana expressions

An expression is a server-side operation that takes query results from one or more data sources and transforms them into new data. Expressions perform calculations like math operations, aggregations, or timestamp alignments without modifying the original data source results. This lets you derive metrics, combine data from different sources, and perform transformations your data sources can't do on their own.

By running on the server, expressions also enable features like alerting to continue working even when no user is viewing a dashboard.

## What problems do expressions solve?

Expressions fill the gap between what your data sources can produce and what your visualizations or alerts need.

They address several common challenges:

- **Cross-data-source calculations:** Combine results from different data sources that can't query each other directly. For example, calculate error rates by dividing HTTP errors from Prometheus by total requests from an SQL database.
- **Derived metrics:** Compute values your data source doesn't provide, such as percentage changes, moving averages, ratios, or conditional logic based on thresholds.
- **Alerting on complex conditions:** Apply math, reductions, and comparisons to drive alert rules when your data source lacks the necessary functions or when you need to alert across multiple data sources.
- **Post-query transformations:** Align timestamps between series, resample data to consistent intervals, filter out non-numeric values, or reduce time series to single summary values.
- **Multi-dimensional data operations:** Perform calculations across multiple series while preserving their label identities. For example, apply the same formula to dozens of host metrics without writing individual queries for each host.
- **Label-based series matching:** Automatically join and combine series based on their labels. For example, match CPU metrics and memory metrics for the same hosts by joining on common labels like `host` or `region`.
- **Data quality handling:** Clean your data by filtering out, replacing, or detecting problematic values such as null, NaN, or infinity values before performing calculations or creating alerts.

Without expressions, you'd need to either modify your data source queries (when possible), use client-side transformations (which don't work for alerting), or export and process data externally.

## Get started

Explore these resources to start using expressions:

- [Create and use expressions](create-use-expressions/) - Learn how to create expressions and use Math, Reduce, and Resample operations
- [Expression examples](expression-examples/) - Practical examples from basic to advanced for common monitoring scenarios
- [Troubleshoot expressions](troubleshoot-expressions/) - Debug and resolve common expression issues
