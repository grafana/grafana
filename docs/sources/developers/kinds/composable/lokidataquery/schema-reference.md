---
keywords:
  - grafana
  - schema
title: LokiDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# LokiDataQuery kind

## Maturity: merged
## Version: 0.0

## Properties

| Property       | Type    | Required | Description                             |
|----------------|---------|----------|-----------------------------------------|
| `editorMode`   | string  | No       | Possible values are: `code`, `builder`. |
| `expr`         | string  | No       | the LogQL query                         |
| `instant`      | boolean | No       | @deprecated, now use queryType          |
| `legendFormat` | string  | No       | used to override the name of the series |
| `maxLines`     | integer | No       | limit the number of log rows returned   |
| `range`        | boolean | No       | @deprecated, now use queryType          |
| `resolution`   | integer | No       |                                         |


