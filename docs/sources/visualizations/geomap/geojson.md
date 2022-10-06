---
aliases:
  - /docs/grafana/latest/features/panels/geomap/geojson/
  - /docs/grafana/latest/panels/visualizations/geomap/geojson/
description: GeoJSON layer
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: GeoJSON layer
weight: 3
---

# GeoJSON layer

The GeoJSON layer allows you to select and load a static GeoJSON file from the filesystem.

- **GeoJSON URL** provides a choice of GeoJSON files that ship with Grafana.
- **Default Style** controls which styles to apply when no rules above match.
  - **Color** configures the color of the default style
  - **Opacity** configures the default opacity
- **Style Rules** apply styles based on feature properties
  - **Rule** allows you to select a _feature_, _condition_, and _value_ from the GeoJSON file in order to define a rule. The trash bin icon can be used to delete the current rule.
  - **Color** configures the color of the style for the current rule
  - **Opacity** configures the transparency level for the current rule
- **Add style rule** creates additional style rules.
