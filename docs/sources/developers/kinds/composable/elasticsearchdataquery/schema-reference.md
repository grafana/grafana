---
keywords:
  - grafana
  - schema
title: ElasticsearchDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# ElasticsearchDataQuery kind

## Maturity: merged
## Version: 0.0

## Properties

| Property     | Type                                      | Required | Description |
|--------------|-------------------------------------------|----------|-------------|
| `alias`      | string                                    | No       |             |
| `bucketAggs` | [BucketAggregation](#bucketaggregation)[] | No       |             |
| `metrics`    | [MetricAggregation](#metricaggregation)[] | No       |             |
| `query`      | string                                    | No       |             |
| `timeField`  | string                                    | No       |             |

## BucketAggregation

| Property | Type | Required | Description |
|----------|------|----------|-------------|

## MetricAggregation

| Property | Type | Required | Description |
|----------|------|----------|-------------|


