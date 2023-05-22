---
keywords:
  - grafana
  - schema
title: NodeGraphPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## NodeGraphPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property       | Type                    | Required | Default | Description |
|----------------|-------------------------|----------|---------|-------------|
| `ArcOption`    | [object](#arcoption)    | **Yes**  |         |             |
| `EdgeOptions`  | [object](#edgeoptions)  | **Yes**  |         |             |
| `NodeOptions`  | [object](#nodeoptions)  | **Yes**  |         |             |
| `PanelOptions` | [object](#paneloptions) | **Yes**  |         |             |

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

### NodeOptions

| Property            | Type                      | Required | Default | Description                                                                             |
|---------------------|---------------------------|----------|---------|-----------------------------------------------------------------------------------------|
| `arcs`              | [ArcOption](#arcoption)[] | No       |         | Define which fields are shown as part of the node arc (colored circle around the node). |
| `mainStatUnit`      | string                    | No       |         | Unit for the main stat to override what ever is set in the data frame.                  |
| `secondaryStatUnit` | string                    | No       |         | Unit for the secondary stat to override what ever is set in the data frame.             |

### PanelOptions

| Property | Type                        | Required | Default | Description |
|----------|-----------------------------|----------|---------|-------------|
| `edges`  | [EdgeOptions](#edgeoptions) | No       |         |             |
| `nodes`  | [NodeOptions](#nodeoptions) | No       |         |             |


