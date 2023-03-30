---
keywords:
  - grafana
  - schema
title: GeomapPanelCfg kind
---
> Both documentation generation and kinds schemas are in active development and subject to change without prior notice.

## GeomapPanelCfg

#### Maturity: [experimental](../../../maturity/#experimental)
#### Version: 0.0



| Property          | Type                       | Required | Default | Description                                   |
|-------------------|----------------------------|----------|---------|-----------------------------------------------|
| `ControlsOptions` | [object](#controlsoptions) | **Yes**  |         |                                               |
| `MapCenterID`     | string                     | **Yes**  |         | Possible values are: `zero`, `coords`, `fit`. |
| `MapViewConfig`   | [object](#mapviewconfig)   | **Yes**  |         |                                               |
| `PanelOptions`    | [object](#paneloptions)    | **Yes**  |         |                                               |
| `TooltipMode`     | string                     | **Yes**  |         | Possible values are: `none`, `details`.       |
| `TooltipOptions`  | [object](#tooltipoptions)  | **Yes**  |         |                                               |

### ControlsOptions

| Property          | Type    | Required | Default | Description              |
|-------------------|---------|----------|---------|--------------------------|
| `mouseWheelZoom`  | boolean | No       |         | let the mouse wheel zoom |
| `showAttribution` | boolean | No       |         | Lower right              |
| `showDebug`       | boolean | No       |         | Show debug               |
| `showMeasure`     | boolean | No       |         | Show measure             |
| `showScale`       | boolean | No       |         | Scale options            |
| `showZoom`        | boolean | No       |         | Zoom (upper left)        |

### MapViewConfig

| Property    | Type    | Required | Default | Description |
|-------------|---------|----------|---------|-------------|
| `id`        | string  | **Yes**  | `zero`  |             |
| `allLayers` | boolean | No       | `true`  |             |
| `lastOnly`  | boolean | No       |         |             |
| `lat`       | int64   | No       | `0`     |             |
| `layer`     | string  | No       |         |             |
| `lon`       | int64   | No       | `0`     |             |
| `maxZoom`   | integer | No       |         |             |
| `minZoom`   | integer | No       |         |             |
| `padding`   | integer | No       |         |             |
| `shared`    | boolean | No       |         |             |
| `zoom`      | int64   | No       | `1`     |             |

### PanelOptions

| Property   | Type                                  | Required | Default | Description |
|------------|---------------------------------------|----------|---------|-------------|
| `basemap`  | [MapLayerOptions](#maplayeroptions)   | **Yes**  |         |             |
| `controls` | [ControlsOptions](#controlsoptions)   | **Yes**  |         |             |
| `layers`   | [MapLayerOptions](#maplayeroptions)[] | **Yes**  |         |             |
| `tooltip`  | [TooltipOptions](#tooltipoptions)     | **Yes**  |         |             |
| `view`     | [MapViewConfig](#mapviewconfig)       | **Yes**  |         |             |

### MapLayerOptions

| Property     | Type                                        | Required | Default | Description                                                                                                                |
|--------------|---------------------------------------------|----------|---------|----------------------------------------------------------------------------------------------------------------------------|
| `name`       | string                                      | **Yes**  |         | configured unique display name                                                                                             |
| `type`       | string                                      | **Yes**  |         |                                                                                                                            |
| `config`     |                                             | No       |         | Custom options depending on the type                                                                                       |
| `filterData` |                                             | No       |         | Defines a frame MatcherConfig that may filter data for the given layer                                                     |
| `location`   | [FrameGeometrySource](#framegeometrysource) | No       |         |                                                                                                                            |
| `opacity`    | integer                                     | No       |         | Common properties:<br/>https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html<br/>Layer opacity (0-1) |
| `tooltip`    | boolean                                     | No       |         | Check tooltip (defaults to true)                                                                                           |

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

### TooltipOptions

| Property | Type   | Required | Default | Description                             |
|----------|--------|----------|---------|-----------------------------------------|
| `mode`   | string | **Yes**  |         | Possible values are: `none`, `details`. |


