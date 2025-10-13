---
aliases:
  - ../../troubleshooting/troubleshoot-queries/
description: Troubleshoot Grafana queries
keywords:
  - grafana
  - troubleshooting
  - documentation
  - guide
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Troubleshoot queries
weight: 200
refs:
  inspect:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/#inspect-query-request-and-response-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/panel-inspector/#inspect-query-request-and-response-data
---

# Troubleshoot queries

This page provides information to solve common dashboard problems.

## I get different results when I rearrange my functions

Function order is very important. Just like in math, the order that you place your functions can affect the result.

## Inspect your query request and response

The most common problems are related to the query and response from your data source. Even if it looks
like a bug or visualization issue in Grafana, it is almost always a problem with the data source query or
the data source response. Start by inspecting your panel query and response.

For more information, refer to [Inspect request and response data](ref:inspect).

## My query is slow

How many data points is your query returning? A query that returns lots of data points will be slow. Try this:

- In **Query options**, limit the **Max data points** returned.
- In **Query options**, increase the **Min interval** time.
- In your query, use a `group by` function.
