---
keywords:
  - grafana
  - schema
title: CanvasPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## CanvasPanelCfg

#### Maturity: [merged](../../../maturity/#merged)
#### Version: 0.0



| Property                | Type                             | Required | Default | Description                                                                         |
|-------------------------|----------------------------------|----------|---------|-------------------------------------------------------------------------------------|
| `BackgroundConfig`      | [object](#backgroundconfig)      | **Yes**  |         |                                                                                     |
| `BackgroundImageSize`   | string                           | **Yes**  |         | Possible values are: `original`, `contain`, `cover`, `fill`, `tile`.                |
| `CanvasConnection`      | [object](#canvasconnection)      | **Yes**  |         |                                                                                     |
| `CanvasElementOptions`  | [object](#canvaselementoptions)  | **Yes**  |         |                                                                                     |
| `ConnectionCoordinates` | [object](#connectioncoordinates) | **Yes**  |         | TODO docs                                                                           |
| `ConnectionPath`        | string                           | **Yes**  |         | TODO docs<br/>Possible values are: `straight`.                                      |
| `Constraint`            | [object](#constraint)            | **Yes**  |         | TODO docs                                                                           |
| `HorizontalConstraint`  | string                           | **Yes**  |         | TODO docs<br/>Possible values are: `left`, `right`, `leftright`, `center`, `scale`. |
| `LineConfig`            | [object](#lineconfig)            | **Yes**  |         | TODO docs                                                                           |
| `Options`               | [object](#options)               | **Yes**  |         |                                                                                     |
| `Placement`             | [object](#placement)             | **Yes**  |         | TODO docs                                                                           |
| `VerticalConstraint`    | string                           | **Yes**  |         | TODO docs<br/>Possible values are: `top`, `bottom`, `topbottom`, `center`, `scale`. |

### BackgroundConfig

| Property | Type                                                | Required | Default | Description                                                          |
|----------|-----------------------------------------------------|----------|---------|----------------------------------------------------------------------|
| `color`  | [ColorDimensionConfig](#colordimensionconfig)       | No       |         |                                                                      |
| `image`  | [ResourceDimensionConfig](#resourcedimensionconfig) | No       |         | Links to a resource (image/svg path)                                 |
| `size`   | string                                              | No       |         | Possible values are: `original`, `contain`, `cover`, `fill`, `tile`. |

### ColorDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### BaseDimensionConfig

| Property | Type   | Required | Default | Description                               |
|----------|--------|----------|---------|-------------------------------------------|
| `field`  | string | No       |         | fixed: T -- will be added by each element |

### ResourceDimensionConfig

Links to a resource (image/svg path)

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `mode`   | string | **Yes**  |         | Possible values are: `fixed`, `field`, `mapping`.                                                            |
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | string | No       |         |                                                                                                              |

### CanvasConnection

| Property     | Type                                            | Required | Default | Description                                    |
|--------------|-------------------------------------------------|----------|---------|------------------------------------------------|
| `path`       | string                                          | **Yes**  |         | TODO docs<br/>Possible values are: `straight`. |
| `source`     | [ConnectionCoordinates](#connectioncoordinates) | **Yes**  |         | TODO docs                                      |
| `target`     | [ConnectionCoordinates](#connectioncoordinates) | **Yes**  |         | TODO docs                                      |
| `color`      | [ColorDimensionConfig](#colordimensionconfig)   | No       |         |                                                |
| `size`       | [ScaleDimensionConfig](#scaledimensionconfig)   | No       |         |                                                |
| `targetName` | string                                          | No       |         |                                                |

### ConnectionCoordinates

TODO docs

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `x`      | number | **Yes**  |         |             |
| `y`      | number | **Yes**  |         |             |

### ScaleDimensionConfig

It extends [BaseDimensionConfig](#basedimensionconfig).

| Property | Type   | Required | Default | Description                                                                                                  |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------|
| `max`    | number | **Yes**  |         |                                                                                                              |
| `min`    | number | **Yes**  |         |                                                                                                              |
| `field`  | string | No       |         | *(Inherited from [BaseDimensionConfig](#basedimensionconfig))*<br/>fixed: T -- will be added by each element |
| `fixed`  | number | No       |         |                                                                                                              |
| `mode`   | string | No       |         | Possible values are: `linear`, `quad`.                                                                       |

### CanvasElementOptions

| Property      | Type                                    | Required | Default | Description |
|---------------|-----------------------------------------|----------|---------|-------------|
| `name`        | string                                  | **Yes**  | `test`  |             |
| `type`        | string                                  | **Yes**  | `test`  |             |
| `background`  | [BackgroundConfig](#backgroundconfig)   | No       |         |             |
| `border`      | [LineConfig](#lineconfig)               | No       |         | TODO docs   |
| `config`      |                                         | No       |         |             |
| `connections` | [CanvasConnection](#canvasconnection)[] | No       |         |             |
| `constraint`  | [Constraint](#constraint)               | No       |         | TODO docs   |
| `placement`   | [Placement](#placement)                 | No       |         | TODO docs   |

### Constraint

TODO docs

| Property     | Type   | Required | Default | Description                                                                         |
|--------------|--------|----------|---------|-------------------------------------------------------------------------------------|
| `horizontal` | string | No       |         | TODO docs<br/>Possible values are: `left`, `right`, `leftright`, `center`, `scale`. |
| `vertical`   | string | No       |         | TODO docs<br/>Possible values are: `top`, `bottom`, `topbottom`, `center`, `scale`. |

### LineConfig

TODO docs

| Property | Type                                          | Required | Default | Description |
|----------|-----------------------------------------------|----------|---------|-------------|
| `color`  | [ColorDimensionConfig](#colordimensionconfig) | No       |         |             |
| `width`  | number                                        | No       |         |             |

### Placement

TODO docs

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `bottom` | number | No       |         |             |
| `height` | number | No       |         |             |
| `left`   | number | No       |         |             |
| `right`  | number | No       |         |             |
| `top`    | number | No       |         |             |
| `width`  | number | No       |         |             |

### Options

| Property            | Type            | Required | Default | Description                      |
|---------------------|-----------------|----------|---------|----------------------------------|
| `inlineEditing`     | boolean         | **Yes**  | `true`  | Enable inline editing            |
| `root`              | [object](#root) | **Yes**  |         |                                  |
| `showAdvancedTypes` | boolean         | **Yes**  | `true`  | Show all available element types |

### Root

| Property   | Type                                            | Required | Default | Description |
|------------|-------------------------------------------------|----------|---------|-------------|
| `elements` | [CanvasElementOptions](#canvaselementoptions)[] | **Yes**  |         |             |
| `type`     | string                                          | **Yes**  | `frame` |             |


