---
aliases:
  - /docs/grafana/latest/features/panels/geomap/zyx/
  - /docs/grafana/latest/panels/visualizations/geomap/zyx/
description: ArcGIS layer
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: XYZ tile layer
weight: 5
---

# XYZ tile layer

The XYZ tile layer is a map from a generic tile layer.

{{< figure src="/static/img/docs/geomap-panel/geomap-xyz-9-1-0.png" max-width="1200px" caption="Geomap panel xyz example" >}}

## Options

- **URL template**

  > **Note:** Set a valid tile server url, with {z}/{x}/{y} for example: https://tile.openstreetmap.org/{z}/{x}/{y}.png

- **Attribution** sets the reference string for the layer if displayed in [map controls]({{< relref "controls/#show-attribution" >}})
- **Opacity** from 0 (transparent) to 1 (opaque)

{{< figure src="/static/img/docs/geomap-panel/geomap-xyz-options-9-1-0.png" max-width="1200px" caption="Geomap panel xyz options" >}}

## More information

- [**Tiled Web Map Wikipedia**](https://en.wikipedia.org/wiki/Tiled_web_map)
- [**List of Open Street Map Tile Servers**](https://wiki.openstreetmap.org/wiki/Tile_servers)
