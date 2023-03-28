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



| Property          | Type                       | Required | Description                                   |
|-------------------|----------------------------|----------|-----------------------------------------------|
| `ControlsOptions` | [object](#controlsoptions) | **Yes**  |                                               |
| `MapCenterID`     | string                     | **Yes**  | Possible values are: `zero`, `coords`, `fit`. |
| `MapViewConfig`   | [object](#mapviewconfig)   | **Yes**  |                                               |
| `PanelOptions`    | [object](#paneloptions)    | **Yes**  |                                               |
| `TooltipMode`     | string                     | **Yes**  | Possible values are: `none`, `details`.       |
| `TooltipOptions`  | [object](#tooltipoptions)  | **Yes**  |                                               |

### ControlsOptions

| Property          | Type    | Required | Description              |
|-------------------|---------|----------|--------------------------|
| `mouseWheelZoom`  | boolean | No       | let the mouse wheel zoom |
| `showAttribution` | boolean | No       | Lower right              |
| `showDebug`       | boolean | No       | Show debug               |
| `showMeasure`     | boolean | No       | Show measure             |
| `showScale`       | boolean | No       | Scale options            |
| `showZoom`        | boolean | No       | Zoom (upper left)        |

### MapViewConfig

| Property    | Type    | Required | Description      |
|-------------|---------|----------|------------------|
| `id`        | string  | **Yes**  | Default: `zero`. |
| `allLayers` | boolean | No       | Default: `true`. |
| `lastOnly`  | boolean | No       |                  |
| `lat`       | int64   | No       | Default: `0`.    |
| `layer`     | string  | No       |                  |
| `lon`       | int64   | No       | Default: `0`.    |
| `maxZoom`   | integer | No       |                  |
| `minZoom`   | integer | No       |                  |
| `padding`   | integer | No       |                  |
| `shared`    | boolean | No       |                  |
| `zoom`      | int64   | No       | Default: `1`.    |

### PanelOptions

| Property   | Type                                  | Required | Description |
|------------|---------------------------------------|----------|-------------|
| `basemap`  | [MapLayerOptions](#maplayeroptions)   | **Yes**  |             |
| `controls` | [ControlsOptions](#controlsoptions)   | **Yes**  |             |
| `layers`   | [MapLayerOptions](#maplayeroptions)[] | **Yes**  |             |
| `tooltip`  | [TooltipOptions](#tooltipoptions)     | **Yes**  |             |
| `view`     | [MapViewConfig](#mapviewconfig)       | **Yes**  |             |

### MapLayerOptions

| Property     | Type                                        | Required | Description                                                                                                                |
|--------------|---------------------------------------------|----------|----------------------------------------------------------------------------------------------------------------------------|
| `name`       | string                                      | **Yes**  | configured unique display name                                                                                             |
| `type`       | string                                      | **Yes**  |                                                                                                                            |
| `config`     |                                             | No       | Custom options depending on the type                                                                                       |
| `filterData` |                                             | No       | Defines a frame MatcherConfig that may filter data for the given layer                                                     |
| `location`   | [FrameGeometrySource](#framegeometrysource) | No       |                                                                                                                            |
| `opacity`    | integer                                     | No       | Common properties:<br/>https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html<br/>Layer opacity (0-1) |
| `tooltip`    | boolean                                     | No       | Check tooltip (defaults to true)                                                                                           |

### FrameGeometrySource

| Property    | Type   | Required | Description                                                 |
|-------------|--------|----------|-------------------------------------------------------------|
| `mode`      | string | **Yes**  | Possible values are: `auto`, `geohash`, `coords`, `lookup`. |
| `gazetteer` | string | No       | Path to Gazetteer                                           |
| `geohash`   | string | No       | Field mappings                                              |
| `latitude`  | string | No       |                                                             |
| `longitude` | string | No       |                                                             |
| `lookup`    | string | No       |                                                             |
| `wkt`       | string | No       |                                                             |

### TooltipOptions

| Property | Type   | Required | Description                             |
|----------|--------|----------|-----------------------------------------|
| `mode`   | string | **Yes**  | Possible values are: `none`, `details`. |


