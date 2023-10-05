---
keywords:
  - grafana
  - schema
labels:
  products:
    - cloud
    - enterprise
    - oss
title: NodeGraphPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## NodeGraphPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property             | Type                          | Required | Default | Description |
|----------------------|-------------------------------|----------|---------|-------------|
| `ArcOption`          | [object](#arcoption)          | **Yes**  |         |             |
| `EdgeOptions`        | [object](#edgeoptions)        | **Yes**  |         |             |
| `FieldNameOverrides` | [object](#fieldnameoverrides) | **Yes**  |         |             |
| `NodeOptions`        | [object](#nodeoptions)        | **Yes**  |         |             |
| `Options`            | [object](#options)            | **Yes**  |         |             |

### ArcOption

| Property | Type   | Required | Default | Description                                                                                         |
|----------|--------|----------|---------|-----------------------------------------------------------------------------------------------------|
| `color`  | string | No       |         | The color of the arc.                                                                               |
| `field`  | string | No       |         | Field from which to get the value. Values should be less than 1, representing fraction of a circle. |

### EdgeOptions

| Property            | Type   | Required | Default | Description                                                                 |
|---------------------|--------|----------|---------|-----------------------------------------------------------------------------|
| `mainStatUnit`      | string | No       |         | Unit for the main stat to override what ever is set in the data frame.      |
| `secondaryStatUnit` | string | No       |         | Unit for the secondary stat to override what ever is set in the data frame. |

### FieldNameOverrides

| Property        | Type   | Required | Default | Description |
|-----------------|--------|----------|---------|-------------|
| `arc`           | string | No       |         |             |
| `color`         | string | No       |         |             |
| `details`       | string | No       |         |             |
| `icon`          | string | No       |         |             |
| `id`            | string | No       |         |             |
| `mainStat`      | string | No       |         |             |
| `nodeRadius`    | string | No       |         |             |
| `secondaryStat` | string | No       |         |             |
| `source`        | string | No       |         |             |
| `subTitle`      | string | No       |         |             |
| `target`        | string | No       |         |             |
| `title`         | string | No       |         |             |

### NodeOptions

| Property            | Type                      | Required | Default | Description                                                                             |
|---------------------|---------------------------|----------|---------|-----------------------------------------------------------------------------------------|
| `arcs`              | [ArcOption](#arcoption)[] | No       |         | Define which fields are shown as part of the node arc (colored circle around the node). |
| `mainStatUnit`      | string                    | No       |         | Unit for the main stat to override what ever is set in the data frame.                  |
| `secondaryStatUnit` | string                    | No       |         | Unit for the secondary stat to override what ever is set in the data frame.             |

### Options

| Property             | Type                                      | Required | Default | Description |
|----------------------|-------------------------------------------|----------|---------|-------------|
| `edges`              | [EdgeOptions](#edgeoptions)               | No       |         |             |
| `fieldNameOverrides` | [FieldNameOverrides](#fieldnameoverrides) | No       |         |             |
| `nodes`              | [NodeOptions](#nodeoptions)               | No       |         |             |


