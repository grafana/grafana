---
keywords:
  - grafana
  - schema
title: ElasticsearchDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# ElasticsearchDataQuery kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property     | Type                                      | Required | Description                 |
|--------------|-------------------------------------------|----------|-----------------------------|
| `alias`      | string                                    | No       | Alias pattern               |
| `bucketAggs` | [BucketAggregation](#bucketaggregation)[] | No       | List of bucket aggregations |
| `metrics`    | [MetricAggregation](#metricaggregation)[] | No       | List of metric aggregations |
| `query`      | string                                    | No       | Lucene query                |
| `timeField`  | string                                    | No       | Name of time field          |

## BucketAggregation

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## MetricAggregation

| Property | Type | Required | Description |
|----------|------|----------|-------------|


