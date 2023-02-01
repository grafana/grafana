---
keywords:
  - grafana
  - schema
title: ParcaDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# ParcaDataQuery kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property        | Type     | Required | Description                                         |
|-----------------|----------|----------|-----------------------------------------------------|
| `groupBy`       | string[] | No       | Allows to group the results.                        |
| `labelSelector` | string   | No       | Specifies the query label selectors. Default: `{}`. |
| `profileTypeId` | string   | No       | Specifies the type of profile to query.             |


