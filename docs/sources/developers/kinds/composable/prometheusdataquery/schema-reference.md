---
keywords:
  - grafana
  - schema
title: PrometheusDataQuery kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

# PrometheusDataQuery kind

### Maturity: merged
### Version: 0.0

## Properties

| Property         | Type    | Required | Description                                          |
|------------------|---------|----------|------------------------------------------------------|
| `editorMode`     | string  | No       | Possible values are: `code`, `builder`.              |
| `exemplar`       | boolean | No       |                                                      |
| `expr`           | string  | No       |                                                      |
| `format`         | string  | No       |                                                      |
| `hinting`        | boolean | No       |                                                      |
| `instant`        | boolean | No       |                                                      |
| `intervalFactor` | integer | No       |                                                      |
| `intervalMs`     | integer | No       |                                                      |
| `interval`       | string  | No       |                                                      |
| `legendFormat`   | string  | No       |                                                      |
| `range`          | boolean | No       |                                                      |
| `requestId`      | string  | No       |                                                      |
| `showingGraph`   | boolean | No       |                                                      |
| `showingTable`   | boolean | No       |                                                      |
| `utcOffsetSec`   | integer | No       | Timezone offset to align start & end time on backend |
| `valueWithRefId` | boolean | No       |                                                      |


