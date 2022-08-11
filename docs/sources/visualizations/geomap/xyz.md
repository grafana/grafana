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
weight: 400
---

# XYZ

A map from a generic tile layer.

## Options

- **URL template**

  > **Note:** Set a valid tile server url, with {z}/{x}/{y} for example: https://tile.openstreetmap.org/{z}/{x}/{y}.png

- **Attribution** sets the reference string for the layer if displayed in [map controls]({{< relref "controls/#show-attribution" >}})
- **Opacity** from 0 (transparent) to 1 (opaque)

## More Information

- [**Tiled Web Map Wikipedia**](https://en.wikipedia.org/wiki/Tiled_web_map)
- [**List of Open Street Map Tile Servers**](https://wiki.openstreetmap.org/wiki/Tile_servers)
