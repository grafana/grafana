---
keywords:
  - grafana
  - schema
labels:
  products:
    - cloud
    - enterprise
    - oss
title: GeomapPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## GeomapPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property  | Type               | Required | Default | Description |
|-----------|--------------------|----------|---------|-------------|
| `Options` | [object](#options) | **Yes**  |         |             |

### Options

| Property   | Type                                  | Required | Default | Description |
|------------|---------------------------------------|----------|---------|-------------|
| `basemap`  | [MapLayerOptions](#maplayeroptions)   | **Yes**  |         |             |
| `controls` | [ControlsOptions](#controlsoptions)   | **Yes**  |         |             |
| `layers`   | [MapLayerOptions](#maplayeroptions)[] | **Yes**  |         |             |
| `tooltip`  | [TooltipOptions](#tooltipoptions)     | **Yes**  |         |             |
| `view`     | [MapViewConfig](#mapviewconfig)       | **Yes**  |         |             |

### ControlsOptions

| Property          | Type    | Required | Default | Description              |
|-------------------|---------|----------|---------|--------------------------|
| `mouseWheelZoom`  | boolean | No       |         | let the mouse wheel zoom |
| `showAttribution` | boolean | No       |         | Lower right              |
| `showDebug`       | boolean | No       |         | Show debug               |
| `showMeasure`     | boolean | No       |         | Show measure             |
| `showScale`       | boolean | No       |         | Scale options            |
| `showZoom`        | boolean | No       |         | Zoom (upper left)        |

### MapLayerOptions

| Property     | Type                                        | Required | Default | Description                                                                                                                                             |
|--------------|---------------------------------------------|----------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`       | string                                      | **Yes**  |         | configured unique display name                                                                                                                          |
| `type`       | string                                      | **Yes**  |         |                                                                                                                                                         |
| `config`     |                                             | No       |         | Custom options depending on the type                                                                                                                    |
| `filterData` |                                             | No       |         | Defines a frame MatcherConfig that may filter data for the given layer                                                                                  |
| `location`   | [FrameGeometrySource](#framegeometrysource) | No       |         |                                                                                                                                                         |
| `opacity`    | number                                      | No       |         | Common properties:<br/>https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html<br/>Layer opacity (0-1)<br/>Constraint: `>=0 & <=1`. |
| `tooltip`    | boolean                                     | No       |         | Check tooltip (defaults to true)                                                                                                                        |

### FrameGeometrySource

| Property    | Type   | Required | Default | Description                                                 |
|-------------|--------|----------|---------|-------------------------------------------------------------|
| `mode`      | string | **Yes**  |         | Possible values are: `auto`, `geohash`, `coords`, `lookup`. |
| `gazetteer` | string | No       |         | Path to Gazetteer                                           |
| `geohash`   | string | No       |         | Field mappings                                              |
| `latitude`  | string | No       |         |                                                             |
| `longitude` | string | No       |         |                                                             |
| `lookup`    | string | No       |         |                                                             |
| `wkt`       | string | No       |         |                                                             |

### MapViewConfig

| Property    | Type    | Required | Default | Description                                                                                                         |
|-------------|---------|----------|---------|---------------------------------------------------------------------------------------------------------------------|
| `id`        | string  | **Yes**  | `zero`  |                                                                                                                     |
| `allLayers` | boolean | No       | `true`  |                                                                                                                     |
| `lastOnly`  | boolean | No       |         |                                                                                                                     |
| `lat`       | number  | No       | `0`     | Constraint: `>=-1.797693134862315708145274237317043567981E+308 & <=1.797693134862315708145274237317043567981E+308`. |
| `layer`     | string  | No       |         |                                                                                                                     |
| `lon`       | number  | No       | `0`     | Constraint: `>=-1.797693134862315708145274237317043567981E+308 & <=1.797693134862315708145274237317043567981E+308`. |
| `maxZoom`   | number  | No       |         |                                                                                                                     |
| `minZoom`   | number  | No       |         |                                                                                                                     |
| `padding`   | number  | No       |         |                                                                                                                     |
| `shared`    | boolean | No       |         |                                                                                                                     |
| `zoom`      | number  | No       | `1`     | Constraint: `>=-340282346638528859811704183484516925440 & <=340282346638528859811704183484516925440`.               |

### TooltipOptions

| Property | Type   | Required | Default | Description                             |
|----------|--------|----------|---------|-----------------------------------------|
| `mode`   | string | **Yes**  |         | Possible values are: `none`, `details`. |


