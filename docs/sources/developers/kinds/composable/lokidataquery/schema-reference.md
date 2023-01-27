---
keywords:
  - grafana
  - schema
title: LokiDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# LokiDataQuery kind

## Maturity: experimental
## Version: 0.0

## Properties

| Property       | Type    | Required | Description                                    |
|----------------|---------|----------|------------------------------------------------|
| `editorMode`   | string  | No       | Possible values are: `code`, `builder`.        |
| `expr`         | string  | No       | The LogQL query.                               |
| `instant`      | boolean | No       | @deprecated, now use queryType.                |
| `legendFormat` | string  | No       | Used to override the name of the series.       |
| `maxLines`     | integer | No       | Used to limit the number of log rows returned. |
| `range`        | boolean | No       | @deprecated, now use queryType.                |
| `resolution`   | integer | No       |                                                |


