---
keywords:
  - grafana
  - schema
title: CanvasPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## CanvasPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property                | Type                             | Required | Default | Description                                                           |
|-------------------------|----------------------------------|----------|---------|-----------------------------------------------------------------------|
| `BackgroundConfig`      | [object](#backgroundconfig)      | **Yes**  |         |                                                                       |
| `BackgroundImageSize`   | string                           | **Yes**  |         | Possible values are: `original`, `contain`, `cover`, `fill`, `tile`.  |
| `CanvasConnection`      | [object](#canvasconnection)      | **Yes**  |         |                                                                       |
| `CanvasElementOptions`  | [object](#canvaselementoptions)  | **Yes**  |         |                                                                       |
| `ConnectionCoordinates` | [object](#connectioncoordinates) | **Yes**  |         |                                                                       |
| `ConnectionPath`        | string                           | **Yes**  |         | Possible values are: `straight`.                                      |
| `Constraint`            | [object](#constraint)            | **Yes**  |         |                                                                       |
| `HorizontalConstraint`  | string                           | **Yes**  |         | Possible values are: `left`, `right`, `leftright`, `center`, `scale`. |
| `LineConfig`            | [object](#lineconfig)            | **Yes**  |         |                                                                       |
| `Options`               | [object](#options)               | **Yes**  |         |                                                                       |
| `Placement`             | [object](#placement)             | **Yes**  |         |                                                                       |
| `VerticalConstraint`    | string                           | **Yes**  |         | Possible values are: `top`, `bottom`, `topbottom`, `center`, `scale`. |

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

| Property     | Type                                            | Required | Default | Description                      |
|--------------|-------------------------------------------------|----------|---------|----------------------------------|
| `path`       | string                                          | **Yes**  |         | Possible values are: `straight`. |
| `source`     | [ConnectionCoordinates](#connectioncoordinates) | **Yes**  |         |                                  |
| `target`     | [ConnectionCoordinates](#connectioncoordinates) | **Yes**  |         |                                  |
| `color`      | [ColorDimensionConfig](#colordimensionconfig)   | No       |         |                                  |
| `size`       | [ScaleDimensionConfig](#scaledimensionconfig)   | No       |         |                                  |
| `targetName` | string                                          | No       |         |                                  |

### ConnectionCoordinates

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

| Property      | Type                                    | Required | Default | Description                                             |
|---------------|-----------------------------------------|----------|---------|---------------------------------------------------------|
| `name`        | string                                  | **Yes**  |         |                                                         |
| `type`        | string                                  | **Yes**  |         |                                                         |
| `background`  | [BackgroundConfig](#backgroundconfig)   | No       |         |                                                         |
| `border`      | [LineConfig](#lineconfig)               | No       |         |                                                         |
| `config`      |                                         | No       |         | TODO: figure out how to define this (element config(s)) |
| `connections` | [CanvasConnection](#canvasconnection)[] | No       |         |                                                         |
| `constraint`  | [Constraint](#constraint)               | No       |         |                                                         |
| `placement`   | [Placement](#placement)                 | No       |         |                                                         |

### Constraint

| Property     | Type   | Required | Default | Description                                                           |
|--------------|--------|----------|---------|-----------------------------------------------------------------------|
| `horizontal` | string | No       |         | Possible values are: `left`, `right`, `leftright`, `center`, `scale`. |
| `vertical`   | string | No       |         | Possible values are: `top`, `bottom`, `topbottom`, `center`, `scale`. |

### LineConfig

| Property | Type                                          | Required | Default | Description |
|----------|-----------------------------------------------|----------|---------|-------------|
| `color`  | [ColorDimensionConfig](#colordimensionconfig) | No       |         |             |
| `width`  | number                                        | No       |         |             |

### Placement

| Property | Type   | Required | Default | Description |
|----------|--------|----------|---------|-------------|
| `bottom` | number | No       |         |             |
| `height` | number | No       |         |             |
| `left`   | number | No       |         |             |
| `right`  | number | No       |         |             |
| `top`    | number | No       |         |             |
| `width`  | number | No       |         |             |

### Options

| Property            | Type            | Required | Default | Description                                                                                                                          |
|---------------------|-----------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------|
| `inlineEditing`     | boolean         | **Yes**  | `true`  | Enable inline editing                                                                                                                |
| `root`              | [object](#root) | **Yes**  |         | The root element of canvas (frame), where all canvas elements are nested<br/>TODO: Figure out how to define a default value for this |
| `showAdvancedTypes` | boolean         | **Yes**  | `true`  | Show all available element types                                                                                                     |

### Root

The root element of canvas (frame), where all canvas elements are nested
TODO: Figure out how to define a default value for this

| Property   | Type                                            | Required | Default | Description                                                    |
|------------|-------------------------------------------------|----------|---------|----------------------------------------------------------------|
| `elements` | [CanvasElementOptions](#canvaselementoptions)[] | **Yes**  |         | The list of canvas elements attached to the root element       |
| `name`     | string                                          | **Yes**  |         | Name of the root element                                       |
| `type`     | string                                          | **Yes**  |         | Type of root element (frame)<br/>Possible values are: `frame`. |


