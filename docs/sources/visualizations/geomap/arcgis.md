---
aliases:
  - /docs/grafana/latest/features/panels/geomap/arcgis/
  - /docs/grafana/latest/panels/visualizations/geomap/arcgis/
description: ArcGIS layer
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: ArcGIS layer
weight: 10
---

# ArcGIS layer

An ArcGIS layer is a layer from an ESRI ArcGIS MapServer.

## Options

- **Server Instance** to select the map type.
  - World Street Map
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wsm-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS World Street Map" >}}
  - World Imagery
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wi-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS World Imagery" >}}
  - World Physical
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wp-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS World Physical" >}}
  - Topographic
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-topographic-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS Topographic" >}}
  - USA Topographic
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-usa-topographic-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS USA Topographic" >}}
  - World Ocean
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-ocean-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS World Ocean" >}}
  - Custom MapServer (see [XYZ]({{< relref "xyz/" >}}) for formatting)
    - URL template
    - Attribution
- **Opacity** from 0 (transparent) to 1 (opaque)

  {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-options-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS options" >}}

## More Information

- [**ArcGIS Services**](https://services.arcgisonline.com/arcgis/rest/services)
- [**About ESRI**](https://www.esri.com/en-us/about/about-esri/overview)
