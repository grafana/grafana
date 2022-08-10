---
aliases:
  - /docs/grafana/latest/features/panels/geomap/controls/
  - /docs/grafana/latest/panels/visualizations/geomap/controls/
description: Map Controls
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: Map controls
weight: 500
---

# Map Controls

## Zoom

### Show zoom control

Displays zoom controls in the upper left corner. This control can be useful when using systems that don't have a mouse.

### Mouse wheel zoom

Enables the mouse wheel to be used for zooming in or out.

## Show Attribution

Displays attribution for the basemap layer.

## Show Scale

Displays scale information in the bottom left corner.

> **Note:** Currently only displays units in [m]/[km].

## Show Measure Tools

Display measure tools in the upper right corner. Measurements will only be displayed when this control is open.

- **Click** to start measuring
- **Continue clicking** to continue measurement
- **Double-click** to end measurement

> **Note:** <br /> - When changing measurement type or units, previous measurement will be removed from the map. <br /> - If the control is closed, then re-opened, most recent measurement will be displayed. <br /> - A measurement can be modified by clicking and dragging on it.

### Length

Get the spherical length of a geometry. This length is the sum of the great circle distances between coordinates. For multi-part geometries, the length is the sum of the length of each part. Geometries are assumed to be in 'EPSG:3857'.

- **Metric (m/km)**
- **Feet (ft)**
- **Miles (mi)**
- **Nautical miles (nmi)**

### Area

Get the spherical area of a geometry. This is the area assuming that polygon edges are segments of great circles on a sphere. Geometries are assumed to be in 'EPSG:3857'.

- **Square Meters (m²)**
- **Square Kilometers (km²)**
- **Square Feet (ft²)**
- **Square Miles (mi²)**
- **Acres (acre)**
- **Hectare (ha)**

## Show Debug

Displays debug information in the upper right corner. This can be useful for debugging or validating a data source.

- **Zoom** displays current zoom level of the map.
- **Center** displays the current **longitude**, **latitude** of the map center.

## Tooltip

- **None** displays tooltips only when clicking on data points.
- **Details** displays tooltips when hovering over data points.
