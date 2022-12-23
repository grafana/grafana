---
aliases:
  - ../../features/panels/geomap/controls/
  - ../../panels/visualizations/geomap/controls/
description: Map Controls
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: Map controls
weight: 100
---

# Map Controls

The map controls section contains various options for map information and tool overlays.
{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-9-1-0.png" max-width="1200px" caption="Geomap panel map controls" >}}

## Zoom

This section describes each of the zoom controls.

### Show zoom control

Displays zoom controls in the upper left corner. This control can be useful when using systems that don't have a mouse.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-zoom-9-1-0.png" max-width="1200px" caption="Geomap panel zoom" >}}

### Mouse wheel zoom

Enables the mouse wheel to be used for zooming in or out.

## Show attribution

Displays attribution for basemap layers.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-attribution-9-1-0.png" max-width="1200px" caption="Geomap panel attribution" >}}

## Show scale

Displays scale information in the bottom left corner.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-scale-9-1-0.png" max-width="1200px" caption="Geomap panel scale" >}}

> **Note:** Currently only displays units in [m]/[km].

## Show measure tools

Displays measure tools in the upper right corner. Measurements appear only when this control is open.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-9-1-0.png" max-width="1200px" caption="Geomap panel measure" >}}

- **Click** to start measuring
- **Continue clicking** to continue measurement
- **Double-click** to end measurement

> **Note:** <br /> - When you change measurement type or units, the previous measurement is removed from the map. <br /> - If the control is closed and then re-opened, the most recent measurement is displayed. <br /> - A measurement can be modified by clicking and dragging on it.

### Length

Get the spherical length of a geometry. This length is the sum of the great circle distances between coordinates. For multi-part geometries, the length is the sum of the length of each part. Geometries are assumed to be in 'EPSG:3857'.

- **Metric (m/km)**
- **Feet (ft)**
- **Miles (mi)**
- **Nautical miles (nmi)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-length-9-1-0.png" max-width="1200px" caption="Geomap panel measure length" >}}

### Area

Get the spherical area of a geometry. This area is calculated assuming that polygon edges are segments of great circles on a sphere. Geometries are assumed to be in 'EPSG:3857'.

- **Square Meters (m²)**
- **Square Kilometers (km²)**
- **Square Feet (ft²)**
- **Square Miles (mi²)**
- **Acres (acre)**
- **Hectare (ha)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-area-9-1-0.png" max-width="1200px" caption="Geomap panel measure area" >}}

## Show debug

Displays debug information in the upper right corner. This can be useful for debugging or validating a data source.

- **Zoom** displays current zoom level of the map.
- **Center** displays the current **longitude**, **latitude** of the map center.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-debug-9-1-0.png" max-width="1200px" caption="Geomap panel debug" >}}

## Tooltip

- **None** displays tooltips only when a data point is clicked.
- **Details** displays tooltips when a mouse pointer hovers over a data point.
