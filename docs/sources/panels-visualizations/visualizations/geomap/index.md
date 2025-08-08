---
aliases:
  - ../../features/panels/geomap/
  - ../../features/panels/geomap/arcgis/
  - ../../features/panels/geomap/carto/
  - ../../features/panels/geomap/controls/
  - ../../features/panels/geomap/daynight/
  - ../../features/panels/geomap/geojson/
  - ../../features/panels/geomap/heatmap/
  - ../../features/panels/geomap/markers/
  - ../../features/panels/geomap/osm/
  - ../../features/panels/geomap/zyx/
  - ../../panels/visualizations/geomap/
  - ../../panels/visualizations/geomap/arcgis/
  - ../../panels/visualizations/geomap/carto/
  - ../../panels/visualizations/geomap/controls/
  - ../../panels/visualizations/geomap/daynight/
  - ../../panels/visualizations/geomap/geojson/
  - ../../panels/visualizations/geomap/heatmap/
  - ../../panels/visualizations/geomap/markers/
  - ../../panels/visualizations/geomap/osm/
  - ../../panels/visualizations/geomap/zyx/
  - ../../visualizations/geomap/
description: Configure options for Grafana's geomap visualization
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Geomap
weight: 100
refs:
  data-format:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/node-graph/#data-api
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/node-graph/#data-api
  provisioning-docs-page:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
---

# Geomap

Geomaps allow you to view and customize the world map using geospatial data. It's the ideal visualization if you have data that includes location information and you want to see it displayed in a map.

You can configure and overlay [map layers](#layer-type), like heatmaps and networks, and blend included basemaps or your own custom maps. This helps you to easily focus on the important location-based characteristics of the data.

{{< figure src="/static/img/docs/geomap-panel/geomap-example-8-1-0.png" max-width="750px" alt="Geomap visualization" >}}

When a geomap is in focus, in addition to typical mouse controls, you can pan around using the arrow keys or zoom in and out using the plus (`+`) and minus (`-`) keys or icons.

Geomaps are also useful when you have location data that’s changing in real time and you want to visualize where an element is moving, using auto-refresh.

You can use a geomap visualization if you need to:

- Track your fleet of vehicles and associated metrics
- Show the locations and statuses of data centers or other connected assets in a network
- Display geographic trends in a heatmap
- Visualize the relationship of your locations' HVAC consumption or solar production with the sun's location

{{< admonition type="note" >}}
We'd love your feedback on the geomap visualization. Please check out the [open Github issues](https://github.com/grafana/grafana/issues?page=1&q=is%3Aopen+is%3Aissue+label%3Aarea%2Fpanel%2Fgeomap) and [submit a new feature request](https://github.com/grafana/grafana/issues/new?assignees=&labels=type%2Ffeature-request,area%2Fpanel%2Fgeomap&title=Geomap:&projects=grafana-dataviz&template=1-feature_requests.md) as needed.
{{< /admonition >}}

## Configure a geomap visualization

The following video provides beginner steps for creating geomap visualizations. You'll learn the data requirements and caveats, special customizations, preconfigured displays and much more:

{{< youtube id="HwM8AFQ7EUs" >}}

{{< docs/play title="Geomap Examples" url="https://play.grafana.org/d/panel-geomap/" >}}

## Supported data formats

To create a geomap visualization, you need datasets containing fields with location information.

The supported location formats are:

- Latitude and longitude
- Geohash
- Lookup codes: country, US states, or airports

To learn more, refer to [Location mode](#location-mode).

Geomaps also support additional fields with various data types to define things like labels, numbers, heat sizes, and colors.

### Example - Latitude and longitude

If you plan to use latitude and longitude coordinates, the dataset must include at least two fields (or columns): one called `latitude` (you can also use`lat`), and one called `longitude` (also `lon` or `lng`). When you use this naming convention, the visualization automatically detects the fields and displays the elements. The order of the fields doesn't matter as long as there is one latitude and one longitude.

| Name            | latitude  | longitude | value |
| --------------- | --------- | --------- | ----- |
| Disneyland      | 33.8121   | -117.9190 | 4     |
| DisneyWorld     | 28.3772   | -81.5707  | 10    |
| EuroDisney      | 48.867374 | 2.784018  | 3     |
| Tokyo Disney    | 35.6329   | 139.8804  | 70    |
| Shanghai Disney | 31.1414   | 121.6682  | 1     |

If your latitude and longitude fields are named differently, you can specify them, as indicated in the [Location mode](#location-mode) section.

### Example - Geohash

If your location data is in geohash format, the visualization requires at least one field (or column) containing location data.

If the field is named `geohash`, the visualization automatically detects the location and displays the elements. The order of the fields doesn't matter and the data set can have multiple other numeric, text, and time fields.

| Name      | geohash      | trips |
| --------- | ------------ | ----- |
| Cancun    | d5f21        | 8     |
| Honolulu  | 87z9ps       | 0     |
| Palm Cove | rhzxudynb014 | 1     |
| Mykonos   | swdj02ey9gyx | 3     |

If your field containing geohash location data is not named as above, you can configure the visualization to use geohash and specify which field to use, as explained in the [Location mode](#location-mode) section.

### Example - Lookup codes

The geomap visualization can identify locations based on country, airport, or US state codes.

For this configuration, the dataset must contain at least one field (or column) containing the location code.

If the field is named `lookup`, the visualization automatically detects it and displays points based on country codes.

| Year | lookup | gdp       |
| ---- | ------ | --------- |
| 2016 | MEX    | 104171935 |
| 2016 | DEU    | 94393454  |
| 2016 | FRA    | 83654250  |
| 2016 | BRA    | 80921527  |
| 2016 | CAN    | 79699762  |

The other location types&mdash; airport codes or US state codes&mdash;aren't automatically detected.

If you want to use other codes or give the field a custom name, you can follow the steps in the [Location mode](#location-mode) section.

## Configuration options

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Map view options

The map view controls the initial view of the map when the dashboard loads.

#### Initial View

The initial view configures how the geomap renders when the panel is first loaded.

- **View** - Sets the center for the map when the panel first loads. Refer to the table following this list for view selections.
- **Zoom** - Sets the initial zoom level.
- **Use current map settings** - Use the settings of the current map to set the center.

<!-- prettier-ignore-start -->
| View selection | Description |
|---|---|
| Fit to data | fits the map view based on the data extents of Map layers and updates when data changes.<ul><li>**Data** - option allows selection of extent based on data from "All layers", a single "Layer", or the "Last value" from a selected layer.</li><li>**Layer** - can be selected if fitting data from a single "Layer" or the "Last value" of a layer.</li><li>**Padding** - sets padding in relative percent beyond data extent (not available when looking at "Last value" only).</li><li>**Max zoom** - sets the maximum zoom level when fitting data.</li> |
| (0°, 0°) |  |
| Coordinates | sets the map view based on: **Latitude** and **Longitude**. |
<!-- prettier-ignore-end -->

Default Views are also available including:

<!-- prettier-ignore-start -->
|               |               |        |        |           |
| ------------- | ------------- | ------ | ------ | --------- |
| North America | South America | Europe | Africa | West Asia |
| South Asia | South-East Asia | East Asia | Australia | Oceania |
<!-- prettier-ignore-end -->

#### Share view

The **Share view** option allows you to link the movement and zoom actions of multiple map visualizations within the same dashboard. The map visualizations that have this option enabled act in tandem when one of them is moved or zoomed, leaving the other ones independent.

{{< admonition type="note" >}}
You might need to reload the dashboard for this feature to work.
{{< /admonition >}}

#### No map repeating

The **No map repeating** option prevents the base map tiles from repeating horizontally when you pan across the world. This constrains the view to a single instance of the world map and avoids visual confusion when displaying global datasets.

{{< admonition type="note" >}}
Enabling this option requires the map to reinitialize.
{{< /admonition >}}

### Map layers options

Geomaps support showing multiple layers. Each layer determines how you visualize geospatial data on top of the base map.

There are three options that you need to set for all maps:

- [Layer type](#layer-type)
- [Data](#data)
- [Location mode](#location-mode)

Other options are dependent on your map layer type and are described within the layer type section.

The layer controls allow you to create layers, change their name, reorder and delete layers.

- **Add layer** creates an additional, configurable data layer for the geomap. When you add a layer, you are prompted to select a layer type. You can change the layer type at any point during panel configuration. See the **Layer Types** section above for details on each layer type.
- **Edit layer name (pencil icon)** renames the layer.
- **Trash Bin** deletes the layer.
- **Reorder (six dots/grab handle)** allows you to change the layer order. Data on higher layers will appear above data on lower layers. The visualization will update the layer order as you drag and drop to help simplify choosing a layer order.

You can add multiple layers of data to a single geomap in order to create rich, detailed visualizations.

#### Layer type

There are seven map layer types to choose from in a geomap.

- [Markers](#markers-layer) renders a marker at each data point.
- [Heatmap](#heatmap-layer) visualizes a heatmap of the data.
- [GeoJSON](#geojson-layer) renders static data from a GeoJSON file.
- [Night / Day](#night--day-layer) renders a night / day region.
- [Route (Beta)](#route-layer-beta) render data points as a route.
- [Photos (Beta)](#photos-layer-beta) renders a photo at each data point.
- [Network (Beta)](#network-layer-beta) visualizes a network graph from the data.
- [Open Street Map](#open-street-map-layer) adds a map from a collaborative free geographic world database.
- [CARTO basemap](#carto-basemap-layer) adds a layer from CARTO Raster basemaps.
- [ArcGIS MapServer](#arcgis-mapserver-layer) adds a layer from an ESRI ArcGIS MapServer.
- [XYZ Tile layer](#xyz-tile-layer) adds a map from a generic tile layer.

{{< admonition type="note" >}}
Beta is equivalent to the [public preview](/docs/release-life-cycle/) release stage.
{{< /admonition >}}

There are also two experimental (or alpha) layer types.

- **Icon at last point (alpha)** renders an icon at the last data point.
- **Dynamic GeoJSON (alpha)** styles a GeoJSON file based on query results.

To enable experimental layers. Set `enable_alpha` to `true` in your configuration file:

```
[panels]
enable_alpha = true
```

To enable the experimental layers using Docker, run the following command:

```
docker run -p 3000:3000 -e "GF_PANELS_ENABLE_ALPHA=true" grafana/grafana:<VERSION>
```

#### Data

Geomaps need a source of geographical data gathered from a data source query which can return multiple datasets. By default Grafana picks the first dataset, but this drop-down allows you to pick other datasets if the query returns more than one.

#### Location mode

There are four options to map the data returned by the selected query:

- **Auto** automatically searches for location data. Use this option when your query is based on one of the following names for data fields.
  - geohash: “geohash”
  - latitude: “latitude”, “lat”
  - longitude: “longitude”, “lng”, “lon”
  - lookup: “lookup”
- **Coords** specifies that your query holds coordinate data. You will get prompted to select numeric data fields for latitude and longitude from your database query.
- **Geohash** specifies that your query holds geohash data. You will be prompted to select a string data field for the geohash from your database query.
- **Lookup** specifies that your query holds location name data that needs to be mapped to a value. You will be prompted to select the lookup field from your database query and a gazetteer. The gazetteer is the directory that is used to map your queried data to a geographical point.

#### Markers layer

The markers layer allows you to display data points as different marker shapes such as circles, squares, triangles, stars, and more.

![Markers Layer](/static/img/docs/geomap-panel/geomap-markers-8-1-0.png)

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | Configure the data settings for the layer. For more information, refer to [Data](#data). |
| Location | Configure the data settings for the layer. For more information, refer to [Location mode](#location-mode). |
| Size | Configures the size of the markers. The default is `Fixed size`, which makes all marker sizes the same regardless of the data; however, there is also an option to size the markers based on data corresponding to a selected field. `Min` and `Max` marker sizes have to be set such that the markers can scale within this range. |
| Symbol | Allows you to choose the symbol, icon, or graphic to aid in providing additional visual context to your data. Choose from assets that are included with Grafana such as simple symbols or the Unicon library. You can also specify a URL containing an image asset. The image must be a scalable vector graphic (SVG). |
| Symbol Vertical Align | Configures the vertical alignment of the symbol relative to the data point. Note that the symbol's rotation angle is applied first around the data point, then the vertical alignment is applied relative to the rotation of the symbol. |
| Symbol Horizontal Align | Configures the horizontal alignment of the symbol relative to the data point. Note that the symbol's rotation angle is applied first around the data point, then the horizontal alignment is applied relative to the rotation of the symbol. |
| Color | Configures the color of the markers. The default `Fixed color` sets all markers to a specific color. There is also an option to have conditional colors depending on the selected field data point values and the color scheme set in the `Standard options` section. |
| Fill opacity | Configures the transparency of each marker. |
| Rotation angle | Configures the rotation angle of each marker. The default is `Fixed value`, which makes all markers rotate to the same angle regardless of the data; however, there is also an option to set the rotation of the markers based on data corresponding to a selected field. |
| Text label | Configures a text label for each marker. |
| Show legend | Allows you to toggle the legend for the layer. |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

#### Heatmap layer

The heatmap layer clusters various data points to visualize locations with different densities.
To add a heatmap layer:

Click on the drop-down menu under Data Layer and choose `Heatmap`.

Similar to `Markers`, you are prompted with various options to determine which data points to visualize and how you want to visualize them.

![Heatmap Layer](/static/img/docs/geomap-panel/geomap-heatmap-8-1-0.png)

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | Configure the data settings for the layer. For more information, refer to [Data](#data). |
| Location | Configure the data settings for the layer. For more information, refer to [Location mode](#location-mode). |
| Weight values | Configures the size of the markers. The default is `Fixed size`, which makes all marker sizes the same regardless of the data; however, there is also an option to size the markers based on data corresponding to a selected field. `Min` and `Max` marker sizes have to be set such that the markers can scale within this range. |
| Radius | Configures the size of the heatmap clusters. |
| Blur | Configures the amount of blur on each cluster. |
| Opacity | Configures the opacity of each cluster. |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

#### GeoJSON layer

The GeoJSON layer allows you to select and load a static GeoJSON file from the filesystem.

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| GeoJSON URL | Provides a choice of GeoJSON files that are included with Grafana. You can also enter a URL manually, which supports variables. |
| Default Style | Controls which styles to apply when no rules above match.<ul><li>**Color** - configures the color of the default style</li><li>**Opacity** - configures the default opacity</li></ul> |
| Style Rules | Apply styles based on feature properties <ul><li>**Rule** - allows you to select a _feature_, _condition_, and _value_ from the GeoJSON file in order to define a rule. The trash bin icon can be used to delete the current rule.</li><li>**Color** - configures the color of the style for the current rule</li><li>**Opacity** - configures the transparency level for the current rule</li> |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

Styles can be set within the "properties" object of the GeoJSON with support for the following geometries:

**Polygon, MultiPolygon**

- **"fill"** - The color of the interior of the polygon(s)
- **"fill-opacity"** - The opacity of the interior of the polygon(s)
- **"stroke-width"** - The width of the line component of the polygon(s)

**Point, MultiPoint**

- **"marker-color"** - The color of the point(s)
- **"marker-size"** - The size of the point(s)

**LineString, MultiLineString**

- **"stroke"** - The color of the line(s)
- **"stroke-width"** - The width of the line(s)

#### Night / Day layer

The Night / Day layer displays night and day regions based on the current time range.

{{< figure src="/static/img/docs/geomap-panel/geomap-day-night-9-1-0.png" max-width="600px" alt="Geomap panel Night / Day" >}}

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | Configures the data set for the layer. For more information, refer to [Data](#data). |
| Show | Toggles the time source from panel time range. |
| Night region color | Picks the color for the night region. |
| Display sun | Toggles the sun icon. |
| Opacity | Set the opacity from `0` (transparent) to `1` (opaque). |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

[Extensions for OpenLayers - DayNight](https://viglino.github.io/ol-ext/examples/layer/map.daynight.html)

#### Route layer (Beta)

{{< admonition type="caution" >}}
The Route layer is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

The Route layer renders data points as a route.

{{< figure src="/media/docs/grafana/geomap-route-layer-basic-9-4-0.png" max-width="600px" alt="Geomap panel Route" >}}

The layer can also render a route with arrows.

{{< figure src="/media/docs/grafana/geomap-route-layer-arrow-size-9-4-0.png" max-width="600px" alt="Geomap panel Route arrows with size" >}}

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | configure the data settings for the layer. For more information, refer to [Data](#data). |
| Location | configure the data settings for the layer. For more information, refer to [Location mode](#location-mode). |
| Size | sets the route thickness. Fixed value by default. When field data is selected you can set the Min and Max range in which field data can scale. |
| Color | sets the route color. Set to `Fixed color` by default. You can also tie the color to field data. |
| Fill opacity | configures the opacity of the route. |
| Text label | configures a text label for each route. |
| Arrow | sets the arrow styling to display along route, in order of data. Choose from: **None**, **Forward**, and **Reverse** |
| Display tooltip | allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

[Extensions for OpenLayers - Flow Line Style](http://viglino.github.io/ol-ext/examples/style/map.style.gpxline.html)

#### Photos layer (Beta)

{{< admonition type="caution" >}}
The Photos layer is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

The Photos layer renders a photo at each data point.

{{< figure src="/static/img/docs/geomap-panel/geomap-photos-9-3-0.png" max-width="600px" alt="Geomap panel Photos" >}}

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | Configure the data settings for the layer. For more information, refer to [Data](#data). |
| Location | Configure the data settings for the layer. For more information, refer to [Location mode](#location-mode). |
| Image Source field | Allows you to select a string field containing image data in either of the following formats:<ul><li>**Image URLs**</li><li>**Base64 encoded** - Image binary ("data:image/png;base64,...")</li></ul> |
| Kind | Sets the frame style around the images. Choose from: **Square**, **Circle**, **Anchored**, and **Folio**. |
| Crop | Toggles whether the images are cropped to fit. |
| Shadow | Toggles a box shadow behind the images. |
| Border | Sets the border size around images. |
| Border color | Sets the border color around images. |
| Radius | Sets the overall size of images in pixels. |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

[Extensions for OpenLayers - Image Photo Style](http://viglino.github.io/ol-ext/examples/style/map.style.photo.html)

#### Network layer (Beta)

{{< admonition type="caution" >}}
The Network layer is currently in [public preview](/docs/release-life-cycle/). Grafana Labs offers limited support, and breaking changes might occur prior to the feature being made generally available.
{{< /admonition >}}

The Network layer renders a network graph. This layer supports the same [data format supported by the node graph visualization](ref:data-format) with the addition of [geospatial data](#location-mode) included in the nodes data. The geospatial data is used to locate and render the nodes on the map.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-geomap-network-layer-v2.png" max-width="750px" alt="Geomap network layer" >}}

You can convert node graph data to a network layer:
{{< video-embed src="/media/docs/grafana/screen-recording-10-1-geomap-network-layer-from-node-graph.mp4" max-width="750px" alt="Node graph to Geomap network layer" >}}

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Data | Configure the data settings for the layer. For more information, refer to [Data](#data). |
| Location | Configure the data settings for the layer. For more information, refer to [Location mode](#location-mode). |
| Arrow | Sets the arrow direction to display for each edge, with forward meaning source to target. Choose from: **None**, **Forward**, **Reverse** and **Both**. |
| Show legend | Allows you to toggle the legend for the layer. **Note:** The legend currently only supports node data. |
| Display tooltip | Allows you to toggle tooltips for the layer. |
<!-- prettier-ignore-end -->

##### Node styles options

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Size | Configures the size of the nodes. The default is `Fixed size`, which makes all node sizes the same regardless of the data; however, there is also an option to size the nodes based on data corresponding to a selected field. `Min` and `Max` node sizes have to be set such that the nodes can scale within this range. |
| Symbol | Allows you to choose the symbol, icon, or graphic to aid in providing additional visual context to your data. Choose from assets that are included with Grafana such as simple symbols or the Unicon library. You can also specify a URL containing an image asset. The image must be a scalable vector graphic (SVG). |
| Color | Configures the color of the nodes. The default `Fixed color` sets all nodes to a specific color. There is also an option to have conditional colors depending on the selected field data point values and the color scheme set in the `Standard options` section. |
| Fill opacity | Configures the transparency of each node. |
| Rotation angle | Configures the rotation angle of each node. The default is `Fixed value`, which makes all nodes rotate to the same angle regardless of the data; however, there is also an option to set the rotation of the nodes based on data corresponding to a selected field. |
| Text label | Configures a text label for each node. |
<!-- prettier-ignore-end -->

##### Edge styles options

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| Size | Configures the line width of the edges. The default is `Fixed size`, which makes all edge line widths the same regardless of the data; however, there is also an option to size the edges based on data corresponding to a selected field. `Min` and `Max` eges sizes have to be set such that the edges can scale within this range. |
| Color | Configures the color of the edges. The default `Fixed color` sets all edges to a specific color. There is also an option to have conditional colors depending on the selected field data point values and the color scheme set in the `Standard options` section. |
| Fill opacity | Configures the transparency of each edge. |
| Text label | Configures a text label for each edge. |
<!-- prettier-ignore-end -->

#### Open Street Map layer

A map from a collaborative free geographic world database.

{{< figure src="/static/img/docs/geomap-panel/geomap-osm-9-1-0.png" max-width="600px" alt="Geomap panel Open Street Map" >}}

- **Opacity** from 0 (transparent) to 1 (opaque)
- **Display tooltip** - allows you to toggle tooltips for the layer.

[About Open Street Map](https://www.openstreetmap.org/about)

#### CARTO basemap layer

A CARTO layer is from CARTO Raster basemaps.

- **Theme**
  - Auto
  - Light
    {{< figure src="/static/img/docs/geomap-panel/geomap-carto-light-9-1-0.png" max-width="600px" alt="Geomap panel CARTO light example" >}}
  - Dark
    {{< figure src="/static/img/docs/geomap-panel/geomap-carto-dark-9-1-0.png" max-width="600px" alt="Geomap panel CARTO dark example" >}}
- **Show labels** shows the Country details on top of the map.
- **Opacity** from 0 (transparent) to 1 (opaque)
- **Display tooltip** - allows you to toggle tooltips for the layer.

[About CARTO](https://carto.com/about-us/)

#### ArcGIS MapServer layer

An ArcGIS layer is a layer from an ESRI ArcGIS MapServer.

- **Server Instance** to select the map type.
  - World Street Map
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wsm-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS World Street Map" >}}
  - World Imagery
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wi-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS World Imagery" >}}
  - World Physical
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-wp-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS World Physical" >}}
  - Topographic
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-topographic-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS Topographic" >}}
  - USA Topographic
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-usa-topographic-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS USA Topographic" >}}
  - World Ocean
    {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-ocean-9-1-0.png" max-width="600px" alt="Geomap panel ArcGIS World Ocean" >}}
  - Custom MapServer (see [XYZ](#xyz-tile-layer) for formatting)
    - URL template
    - Attribution
- **Opacity** from 0 (transparent) to 1 (opaque)
- **Display tooltip** - allows you to toggle tooltips for the layer.

##### More Information

- [ArcGIS Services](https://services.arcgisonline.com/arcgis/rest/services)
- [About ESRI](https://www.esri.com/en-us/about/about-esri/overview)

#### XYZ Tile layer

The XYZ Tile layer is a map from a generic tile layer.

{{< figure src="/static/img/docs/geomap-panel/geomap-xyz-9-1-0.png" max-width="600px" alt="Geomap panel xyz example" >}}

- **URL template** - Set a valid tile server url, with {z}/{x}/{y} for example: https://tile.openstreetmap.org/{z}/{x}/{y}.png
- **Attribution** sets the reference string for the layer if displayed in [map controls](#show-attribution)
- **Opacity** from 0 (transparent) to 1 (opaque)

##### More information

- [Tiled Web Map Wikipedia](https://en.wikipedia.org/wiki/Tiled_web_map)
- [List of Open Street Map Tile Servers](https://wiki.openstreetmap.org/wiki/Tile_servers)

### Basemap layer options

A basemap layer provides the visual foundation for a mapping application. It typically contains data with global coverage. Several base layer options
are available each with specific configuration options to style the base map.

Basemap layer types can also be added as layers. You can specify an opacity.

There are four basemap layer types to choose from in a geomap.

- [Open Street Map](#open-street-map-layer) adds a map from a collaborative free geographic world database.
- [CARTO basemap](#carto-basemap-layer) adds a layer from CARTO Raster basemaps.
- [ArcGIS MapServer](#arcgis-mapserver-layer) adds a layer from an ESRI ArcGIS MapServer.
- [XYZ Tile layer](#xyz-tile-layer) adds a map from a generic tile layer.

The default basemap layer uses the CARTO map. You can define custom default base layers in the `.ini` configuration file.

![Basemap layer options](/static/img/docs/geomap-panel/geomap-baselayer-8-1-0.png)

#### Configure the default base layer with provisioning

You can configure the default base map using config files with Grafana’s provisioning system. For more information on all the settings, refer to the [provisioning docs page](ref:provisioning-docs-page).

Use the JSON configuration option `default_baselayer_config` to define the default base map. There are currently four base map options to choose from: `carto`, `esri-xyz`, `osm-standard`, `xyz`. Here are some provisioning examples for each base map option.

- **carto** loads the CartoDB tile server. You can choose from `auto`, `dark`, and `light` theme for the base map and can be set as shown below. The `showLabels` tag determines whether or not Grafana shows the Country details on top of the map. Here is an example:

```ini
geomap_default_baselayer = `{
  "type": "carto",
  "config": {
    "theme": "auto",
    "showLabels": true
  }
}`
```

- **esri-xyz** loads the ESRI tile server. There are already multiple server instances implemented to show the various map styles: `world-imagery`, `world-physical`, `topo`, `usa-topo`, and `ocean`. The `custom` server option allows you to configure your own ArcGIS map server. Here are some examples:

{{< tabs >}}
{{< tab-content name="World imagery" >}}

```ini
geomap_default_baselayer = `{
  "type": "esri-xyz",
  "config": {
    "server": "world-imagery"
  }
}`
```

{{< /tab-content >}}
{{< tab-content name="Custom" >}}

```ini
geomap_default_baselayer = `{
  "type": "esri-xyz",
  "config": {
    "server": "custom",
    "url": "[tile server url]",
    "attribution": "[tile server attribution]"
  }
}`
```

{{< /tab-content >}}
{{< /tabs >}}

- **osm-standard** loads the OpenStreetMap tile server. There are no additional configurations needed and the `config` fields can be left blank. Here is an example:

```ini
default_baselayer_config = `{
  "type": "osm-standard",
  "config": {}
}`
```

- **xyz** loads a custom tile server defined by the user. Set a valid tile server `url`, with {z}/{x}/{y} for this option in order to properly load a default base map. Here is an example:

```ini
default_baselayer_config = `{
  "type": "xyz",
  "config": {
    "attribution": "Open street map",
    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
}`
```

`enable_custom_baselayers` allows you to enable or disable custom open source base maps that are already implemented. The default is `true`.

### Map controls options

The map controls section contains various options for map information and tool overlays.

<!-- prettier-ignore-start -->
| Option | Description |
| ------ | ----------- |
| [Show zoom control](#show-zoom-control) | Displays zoom controls in the upper left corner. |
| [Mouse wheel zoom](#mouse-wheel-zoom) | Enables the mouse wheel to be used for zooming in or out. |
| [Show attribution](#show-attribution) | Displays attribution for basemap layers. |
| [Show scale](#show-scale) | Displays scale information in the bottom left corner in meters (m) or kilometers (km). |
| [Show measure tools](#show-measure-tools) | Displays measure tools in the upper right corner. This includes the [Length](#length) and [Area](#area) options. |
| [Show debug](#show-debug) | Displays debug information in the upper right corner. |
| [Tooltip](#tooltip) | Controls display of tooltips. |
<!-- prettier-ignore-end -->

#### Show zoom control

Displays zoom controls in the upper left corner. This control can be useful when using systems that don't have a mouse.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-zoom-9-1-0.png" max-width="300px" alt="Geomap panel zoom" >}}

#### Mouse wheel zoom

Enables the mouse wheel to be used for zooming in or out.

#### Show attribution

Displays attribution for basemap layers.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-attribution-9-1-0.png" max-width="400px" alt="Geomap panel attribution" >}}

#### Show scale

Displays scale information in the bottom left corner in meters (m) or kilometers (km).

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-scale-9-1-0.png" max-width="400px" alt="Geomap panel scale" >}}

#### Show measure tools

Displays measure tools in the upper right corner. Measurements appear only when this control is open.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-9-1-0.png" max-width="400px" alt="Geomap panel measure" >}}

- **Click** to start measuring
- **Continue clicking** to continue measurement
- **Double-click** to end measurement

When you change measurement type or units, the previous measurement is removed from the map. If the control is closed and then re-opened, the most recent measurement is displayed. A measurement can be modified by clicking and dragging on it.

##### Length

Get the spherical length of a geometry. This length is the sum of the great circle distances between coordinates. For multi-part geometries, the length is the sum of the length of each part. Geometries are assumed to be in 'EPSG:3857'.

- **Metric (m/km)**
- **Feet (ft)**
- **Miles (mi)**
- **Nautical miles (nmi)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-length-9-1-0.png" max-width="400px" alt="Geomap panel measure length" >}}

##### Area

Get the spherical area of a geometry. This area is calculated assuming that polygon edges are segments of great circles on a sphere. Geometries are assumed to be in 'EPSG:3857'.

- **Square Meters (m²)**
- **Square Kilometers (km²)**
- **Square Feet (ft²)**
- **Square Miles (mi²)**
- **Acres (acre)**
- **Hectare (ha)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-area-9-1-0.png" max-width="550px" alt="Geomap panel measure area" >}}

#### Show debug

Displays debug information in the upper right corner. This can be useful for debugging or validating a data source.

- **Zoom** displays current zoom level of the map.
- **Center** displays the current **longitude**, **latitude** of the map center.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-debug-9-1-0.png" max-width="400px" alt="Geomap panel debug" >}}

#### Tooltip

Tooltips are supported for the **Markers**, **Heatmap**, **Photos** (beta) layers.
For these layer types, choose from the following tooltip options:

- **None** displays tooltips only when a data point is clicked.
- **Details** displays tooltips when a mouse pointer hovers over a data point.

When a data point on the geomap represents one row&mdash;that is, only a single row of response data is relevant to that point&mdash;the tooltip displays a grid with the row's names and values:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-single-row-marker-v12.1.png" max-width="750px" alt="A data point with one row of associated data" >}}

When a data point represents more than one row&mdash;that is, different rows but with the same geographical information&mdash;then each row appears as a single entry:

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-multiple-row-marker-v12.1.png" max-width="750px" alt="A data point with mulitple rows of associated data" >}}

The text displayed in each tooltip row is associated with the first field value in each data row. 
Click it to expand and display the full details of the data row.

{{< admonition type="note" >}}
The data appearing in each detail row is determined by the underlying query and transformations applied to the query's results, and can't be directly controlled using tooltip options.
{{< /admonition >}}

### Standard options

{{< docs/shared lookup="visualizations/standard-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Data links and actions

{{< docs/shared lookup="visualizations/datalink-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Value mappings

{{< docs/shared lookup="visualizations/value-mappings-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Thresholds

{{< docs/shared lookup="visualizations/thresholds-options-2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Field overrides

{{< docs/shared lookup="visualizations/overrides-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}
