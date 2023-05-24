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
description: Geomap visualization documentation
keywords:
  - grafana
  - Geomap
  - panel
  - documentation
title: Geomap
weight: 600
---

# Geomap

The Geomap panel visualization allows you to view and customize the world map using geospatial data. You can configure various overlay styles and map view settings to easily focus on the important location-based characteristics of the data.

> We would love your feedback on Geomap. Please check out the [Github discussion](https://github.com/grafana/grafana/discussions/62159) and join the conversation.

{{< figure src="/static/img/docs/geomap-panel/geomap-example-8-1-0.png" max-width="1200px" caption="Geomap panel" >}}

## Map View

The map view controls the initial view of the map when the dashboard loads.

### Initial View

The initial view configures how the GeoMap panel renders when the panel is first loaded.

- **View** sets the center for the map when the panel first loads.
  - **Fit to data** fits the map view based on the data extents of Map layers and updates when data changes.
    - **Data** option allows selection of extent based on data from "All layers", a single "Layer", or the "Last value" from a selected layer.
    - **Layer** can be selected if fitting data from a single "Layer" or the "Last value" of a layer.
    - **Padding** sets padding in relative percent beyond data extent (not available when looking at "Last value" only).
    - **Max Zoom** sets the maximum zoom level when fitting data.
  - **Coordinates** sets the map view based on:
    - **Latitude**
    - **Longitude**
  - Default Views are also available including:
    - **(0°, 0°)**
    - **North America**
    - **South America**
    - **Europe**
    - **Africa**
    - **West Asia**
    - **South Asia**
    - **South-East Asia**
    - **East Asia**
    - **Australia**
    - **Oceania**
- **Zoom** sets the initial zoom level.

## Map layers

The Geomap visualization supports showing multiple layers. Each layer determines how you visualize geospatial data on top of the base map.

### Types

There are three map layer types to choose from in the Geomap visualization.

- [Markers]({{< relref "#markers-layer" >}}) renders a marker at each data point.
- [Heatmap]({{< relref "#heatmap-layer" >}}) visualizes a heatmap of the data.
- [GeoJSON]({{< relref "#geojson-layer" >}}) renders static data from a GeoJSON file.

There are also five alpha layer types.

- [Night / Day layer]({{< relref "#night--day-layer" >}}) renders a night / day region.
- **Icon at last point (alpha)** renders an icon at the last data point.
- **Dynamic GeoJSON (alpha)** styles a GeoJSON file based on query results.
- [Route layer (Alpha)]({{< relref "#route-layer-alpha" >}}) render data points as a route.
- [Photos layer (Alpha)]({{< relref "#photos-layer-alpha" >}}) renders a photo at each data point.

{{% admonition type="note" %}}
[Basemap layer types]({{< relref "#types-1" >}}) can also be added as layers. You can specify an opacity.
{{% /admonition %}}

### Layer Controls

The layer controls allow you to create layers, change their name, reorder and delete layers.

- **Add layer** creates an additional, configurable data layer for the Geomap visualization. When you add a layer, you are prompted to select a layer type. You can change the layer type at any point during panel configuration. See the **Layer Types** section above for details on each layer type.
- The layer controls allow you to rename, delete, and reorder the layers of the panel.
  - **Edit layer name (pencil icon)** renames the layer.
  - **Trash Bin** deletes the layer.
  - **Reorder (six dots/grab handle)** allows you to change the layer order. Data on higher layers will appear above data on lower layers. The panel will update the layer order as you drag and drop to help simplify choosing a layer order.

You can add multiple layers of data to a single Geomap panel in order to create rich, detailed visualizations.

### Location

The Geomap panel needs a source of geographical data. This data comes from a database query, and there are four mapping options for your data.

- **Auto** automatically searches for location data. Use this option when your query is based on one of the following names for data fields.
  - geohash: “geohash”
  - latitude: “latitude”, “lat”
  - longitude: “longitude”, “lng”, “lon”
  - lookup: “lookup”
- **Coords** specifies that your query holds coordinate data. You will get prompted to select numeric data fields for latitude and longitude from your database query.
- **Geohash** specifies that your query holds geohash data. You will be prompted to select a string data field for the geohash from your database query.
- **Lookup** specifies that your query holds location name data that needs to be mapped to a value. You will be prompted to select the lookup field from your database query and a gazetteer. The gazetteer is the directory that is used to map your queried data to a geographical point.

## Basemap layer

A basemap layer provides the visual foundation for a mapping application. It typically contains data with global coverage. Several base layer options
are available each with specific configuration options to style the base map.

### Types

There are four basemap layer types to choose from in the Geomap visualization.

- [Open Street Map]({{< relref "#open-street-map-layer" >}}) adds a map from a collaborative free geographic world database.
- [CARTO]({{< relref "#carto-layer" >}}) adds a layer from CARTO Raster basemaps.
- [ArcGIS]({{< relref "#arcgis-layer" >}}) adds a layer from an ESRI ArcGIS MapServer.
- [XYZ]({{< relref "#xyz-tile-layer" >}}) adds a map from a generic tile layer.

### Default

The default base layer uses the [CARTO]({{< relref "#carto-layer" >}}) map. You can define custom default base layers in the `.ini` configuration file.

![Basemap layer options](/static/img/docs/geomap-panel/geomap-baselayer-8-1-0.png)

#### Configure the default base layer with provisioning

You can configure the default base map using config files with Grafana’s provisioning system. For more information on all the settings, refer to the [provisioning docs page]({{< relref "../../../administration/provisioning/" >}}).

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

```ini
geomap_default_baselayer = `{
  "type": "esri-xyz",
  "config": {
    "server": "world-imagery"
  }
}`
```

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

## Markers layer

The markers layer allows you to display data points as different marker shapes such as circles, squares, triangles, stars, and more.

![Markers Layer](/static/img/docs/geomap-panel/geomap-markers-8-1-0.png)

![Markers Layer Options](/static/img/docs/geomap-panel/geomap-markers-options-8-1-0.png)

- **Marker Color** configures the color of the marker. The default `Single color` keeps all points a single color. There is an alternate option to have multiple colors depending on the data point values and the threshold set at the `Thresholds` section.
- **Marker Size** configures the size of the marker. The default is `Fixed size`, which makes all marker sizes the same regardless of the data points. However, there is also an option to scale the circles to the corresponding data points. `Min` and `Max` marker size has to be set such that the Marker layer can scale within this range.
- **Marker Shape** allows you to choose the shape, icon, or graphic to aid in providing additional visual context to your data. Choose from assets that are included with Grafana such as simple shapes or the Unicon library. You can also specify a URL containing an image asset. The image must be a scalable vector graphic (SVG).
- **Fill opacity** configures the transparency of each marker.

## Heatmap layer

The heatmap layer clusters various data points to visualize locations with different densities.
To add a heatmap layer:

Click on the drop-down menu under Data Layer and choose `Heatmap`.

Similar to `Markers`, you are prompted with various options to determine which data points to visualize and how you want to visualize them.

![Heatmap Layer](/static/img/docs/geomap-panel/geomap-heatmap-8-1-0.png)

![Heatmap Layer Options](/static/img/docs/geomap-panel/geomap-heatmap-options-8-1-0.png)

- **Weight values** configure the intensity of the heatmap clusters. `Fixed value` keeps a constant weight value throughout all data points. This value should be in the range of 0~1. Similar to Markers, there is an alternate option in the drop-down to automatically scale the weight values depending on data values.
- **Radius** configures the size of the heatmap clusters.
- **Blur** configures the amount of blur on each cluster.

## GeoJSON layer

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

## CARTO layer

A CARTO layer is from CARTO Raster basemaps.

### Options

- **Theme**
  - Auto
  - Light
    {{< figure src="/static/img/docs/geomap-panel/geomap-carto-light-9-1-0.png" max-width="1200px" caption="Geomap panel CARTO light example" >}}
  - Dark
    {{< figure src="/static/img/docs/geomap-panel/geomap-carto-dark-9-1-0.png" max-width="1200px" caption="Geomap panel CARTO dark example" >}}
- **Show labels** shows the Country details on top of the map.
- **Opacity** from 0 (transparent) to 1 (opaque)

{{< figure src="/static/img/docs/geomap-panel/geomap-carto-options-9-1-0.png" max-width="1200px" caption="Geomap panel CARTO options" >}}

### More Information

- [**About CARTO**](https://carto.com/about-us/)

## XYZ tile layer

The XYZ tile layer is a map from a generic tile layer.

{{< figure src="/static/img/docs/geomap-panel/geomap-xyz-9-1-0.png" max-width="1200px" caption="Geomap panel xyz example" >}}

### Options

- **URL template**

  > **Note:** Set a valid tile server url, with {z}/{x}/{y} for example: https://tile.openstreetmap.org/{z}/{x}/{y}.png

- **Attribution** sets the reference string for the layer if displayed in [map controls]({{< relref "#show-attribution" >}})
- **Opacity** from 0 (transparent) to 1 (opaque)

{{< figure src="/static/img/docs/geomap-panel/geomap-xyz-options-9-1-0.png" max-width="1200px" caption="Geomap panel xyz options" >}}

### More information

- [**Tiled Web Map Wikipedia**](https://en.wikipedia.org/wiki/Tiled_web_map)
- [**List of Open Street Map Tile Servers**](https://wiki.openstreetmap.org/wiki/Tile_servers)

## Open Street Map layer

A map from a collaborative free geographic world database.

{{< figure src="/static/img/docs/geomap-panel/geomap-osm-9-1-0.png" max-width="1200px" caption="Geomap panel Open Street Map" >}}

### Options

- **Opacity** from 0 (transparent) to 1 (opaque)

{{< figure src="/static/img/docs/geomap-panel/geomap-osm-options-9-1-0.png" max-width="1200px" caption="Geomap panel Open Street Map options" >}}

### More Information

- [**About Open Street Map**](https://www.openstreetmap.org/about)\

## ArcGIS layer

An ArcGIS layer is a layer from an ESRI ArcGIS MapServer.

### Options

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
  - Custom MapServer (see [XYZ]({{< relref "#xyz-tile-layer" >}}) for formatting)
    - URL template
    - Attribution
- **Opacity** from 0 (transparent) to 1 (opaque)

  {{< figure src="/static/img/docs/geomap-panel/geomap-arcgis-options-9-1-0.png" max-width="1200px" caption="Geomap panel ArcGIS options" >}}

### More Information

- [**ArcGIS Services**](https://services.arcgisonline.com/arcgis/rest/services)
- [**About ESRI**](https://www.esri.com/en-us/about/about-esri/overview)

## Night / Day layer

The Night / Day layer displays night and day regions based on the current time range.

{{< figure src="/static/img/docs/geomap-panel/geomap-day-night-9-1-0.png" max-width="1200px" caption="Geomap panel Night / Day" >}}

### Options

- **Show** toggles time source from panel time range
- **Night region color** picks color for night region
- **Display sun** toggles sun icon
- **Opacity** from 0 (transparent) to 1 (opaque)

{{< figure src="/static/img/docs/geomap-panel/geomap-day-night-options-9-1-0.png" max-width="1200px" caption="Geomap panel Night / Day options" >}}

### More information

- [**Extensions for OpenLayers - DayNight**](https://viglino.github.io/ol-ext/examples/layer/map.daynight.html)

## Route layer (Alpha)

The Route layer renders data points as a route.

{{< figure src="/media/docs/grafana/geomap-route-layer-basic-9-4-0.png" max-width="1200px" caption="Geomap panel Route" >}}

### Options

- **Size** sets the route thickness. Fixed by default, or Min and Max range of selected field.
- **Color** sets the route color. Fixed by default or Standard Options color scheme on selected field.
- **Arrow** sets the arrow styling to display along route, in order of data.
  - **None**
  - **Forward**
  - **Reverse**

{{< figure src="/media/docs/grafana/geomap-route-layer-arrow-size-9-4-0.png" max-width="1200px" caption="Geomap panel Route arrows with size" >}}

### More information

- [**Extensions for OpenLayers - Flow Line Style**](http://viglino.github.io/ol-ext/examples/style/map.style.gpxline.html)

## Photos layer (Alpha)

The Photos layer renders a photo at each data point.

{{< figure src="/static/img/docs/geomap-panel/geomap-photos-9-3-0.png" max-width="1200px" caption="Geomap panel Photos" >}}

### Options

- **Image Source Field** select a string field containing image data in either of the following formats
  - **Image URLs**
  - **Base64 encoded** image binary ("data:image/png;base64,...")
- **Kind** select the frame style around the images
  - **Square**
  - **Circle**
  - **Anchored**
  - **Folio**
- **Crop** toggle if the images are cropped to fit
- **Shadow** toggle a box shadow behind the images
- **Border** set the border size around images
- **Border color** set the border color around images
- **Radius** set the overall size of images in pixels

{{< figure src="/static/img/docs/geomap-panel/geomap-photos-options-9-3-0.png" max-width="1200px" caption="Geomap panel Photos options" >}}

### More information

- [**Extensions for OpenLayers - Image Photo Style**](http://viglino.github.io/ol-ext/examples/style/map.style.photo.html)

## Map Controls

The map controls section contains various options for map information and tool overlays.
{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-9-1-0.png" max-width="1200px" caption="Geomap panel map controls" >}}

### Zoom

This section describes each of the zoom controls.

#### Show zoom control

Displays zoom controls in the upper left corner. This control can be useful when using systems that don't have a mouse.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-zoom-9-1-0.png" max-width="1200px" caption="Geomap panel zoom" >}}

#### Mouse wheel zoom

Enables the mouse wheel to be used for zooming in or out.

### Show attribution

Displays attribution for basemap layers.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-attribution-9-1-0.png" max-width="1200px" caption="Geomap panel attribution" >}}

### Show scale

Displays scale information in the bottom left corner.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-scale-9-1-0.png" max-width="1200px" caption="Geomap panel scale" >}}

{{% admonition type="note" %}}
Currently only displays units in [m]/[km].
{{% /admonition %}}

### Show measure tools

Displays measure tools in the upper right corner. Measurements appear only when this control is open.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-9-1-0.png" max-width="1200px" caption="Geomap panel measure" >}}

- **Click** to start measuring
- **Continue clicking** to continue measurement
- **Double-click** to end measurement

{{% admonition type="note" %}}
<br /- When you change measurement type or units, the previous measurement is removed from the map. <br /- If the control is closed and then re-opened, the most recent measurement is displayed. <br /- A measurement can be modified by clicking and dragging on it.
{{% /admonition %}}

#### Length

Get the spherical length of a geometry. This length is the sum of the great circle distances between coordinates. For multi-part geometries, the length is the sum of the length of each part. Geometries are assumed to be in 'EPSG:3857'.

- **Metric (m/km)**
- **Feet (ft)**
- **Miles (mi)**
- **Nautical miles (nmi)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-length-9-1-0.png" max-width="1200px" caption="Geomap panel measure length" >}}

#### Area

Get the spherical area of a geometry. This area is calculated assuming that polygon edges are segments of great circles on a sphere. Geometries are assumed to be in 'EPSG:3857'.

- **Square Meters (m²)**
- **Square Kilometers (km²)**
- **Square Feet (ft²)**
- **Square Miles (mi²)**
- **Acres (acre)**
- **Hectare (ha)**

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-measure-area-9-1-0.png" max-width="1200px" caption="Geomap panel measure area" >}}

### Show debug

Displays debug information in the upper right corner. This can be useful for debugging or validating a data source.

- **Zoom** displays current zoom level of the map.
- **Center** displays the current **longitude**, **latitude** of the map center.

{{< figure src="/static/img/docs/geomap-panel/geomap-map-controls-debug-9-1-0.png" max-width="1200px" caption="Geomap panel debug" >}}

### Tooltip

- **None** displays tooltips only when a data point is clicked.
- **Details** displays tooltips when a mouse pointer hovers over a data point.
