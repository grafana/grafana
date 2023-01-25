---
keywords:
  - grafana
  - schema
title: PhlareDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# PhlareDataQuery kind

## Maturity: merged
## Version: 0.0

## Properties

| Property        | Type     | Required | Description                                                         |
|-----------------|----------|----------|---------------------------------------------------------------------|
| `groupBy`       | string[] | No       |                                                                     |
| `labelSelector` | string   | No       | Default: `{}`.                                                      |
| `profileTypeId` | string   | No       |                                                                     |
| `queryType`     | string   | No       | Possible values are: `both`, `profile`, `metrics`. Default: `both`. |


