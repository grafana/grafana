---
keywords:
  - grafana
  - schema
title: TempoDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# TempoDataQuery kind

## Maturity: merged
## Version: 0.0

## Properties

| Property          | Type   | Required | Description                                                                                |
|-------------------|--------|----------|--------------------------------------------------------------------------------------------|
| `limit`           | number | No       |                                                                                            |
| `maxDuration`     | string | No       |                                                                                            |
| `minDuration`     | string | No       |                                                                                            |
| `queryType`       | string | No       | Possible values are: `traceql`, `search`, `serviceMap`, `upload`, `nativeSearch`, `clear`. |
| `query`           | string | No       |                                                                                            |
| `search`          | string | No       |                                                                                            |
| `serviceMapQuery` | string | No       |                                                                                            |
| `serviceName`     | string | No       |                                                                                            |
| `spanName`        | string | No       |                                                                                            |


