+++
title = "Geomap"
description = "Geomap visualization documentation"
keywords = ["grafana", "Geomap", "panel", "documentation"]
aliases =["/docs/grafana/latest/features/panels/geomap/"]
weight = 600
+++

# Geomap

{{< figure src="/static/img/docs/geomap-panel/geomap_example.png" max-width="1200px" caption="Geomap panel" >}}

The Geomap panel visualization allows you to view and customize the world map using geospatial data in respect to geographical locations. Various overlay styles and map view settings can be configured to easily focus on the important location-based characteristics of the data.


## Base layer

Base layer loads in a blank world map from the tile server to the Grafana panel. There are several base layer options available for you to choose from, each with their specific configuration options to style the base map. Default base layer is CartoDB base map, but can be specified differently through the `.ini` configuration file.

![Base layer options](/static/img/docs/geomap-panel/geomap_base_layer.png)

### Configure the default base layer with provisioning

It is possible to configure the default base map using config files with Grafana’s provisioning system. You can read more about how it works and all the settings you can set on the [provisioning docs page]({{< relref "../administration/provisioning.md" >}}).

`default_baselayer_config` is the JSON configuration used to define the default base map. There are currently four base map options to choose from: `carto`, `esri-xyz`, `osm-standard`, `xyz`. Here are some provisioning examples for each base map options.

- **carto** loads the CartoDB tile server. There is a choice between `auto`, `dark`, and `light` theme for the base map and can be set correspondingly as shown below. `showLabels` tag determines whether or not to show the Country details on top of the map.

```ini
geomap_default_baselayer = `{
  "type": "carto",
  "config": {
    "theme": "auto",
    "showLabels": true
  }
}`
```

- **esri-xyz** loads the ESRI tile server. There are already multiple server instances implemented to show the various map styles: `world-imagery`, `world-physical`, `topo`, `usa-topo`, and `ocean`. There is also a `custom` server option which allows to configure your own ArcGIS map server.

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

- **osm-standard** loads the OpenStreetMap tile server. There is no additional `config` fields needed to be set and can be left blank. 

```ini
default_baselayer_config = `{
  "type": "osm-standard",
  "config": {}
}`
```

- **xyz** loads a custom tile server defined by the user.  A valid tile server `url`, with {z}/{x}/{y}, has to be set in order for this option to properly load a default base map.

```ini
default_baselayer_config = `{
  "type": "xyz",
  "config": {
    "attribution": "Open street map",
    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
}`
```

`enable_custom_baselayers` gives the option to enable/disable custom open source base maps that are already implemented. This will be defaulted to `true`.

## Data layer

Data layer in the Geomap plugin determines how you visualize geospatial data on top of the base map.

### Location
The Geomap panel needs a source of geographical data. The data comes from a database query, and there are four mapping options for your data.

- **Auto** will automatically search for location data. Use this data option when your query is based on one of the following names for data fields.
  - geohash: “geohash”
  - latitude: “latitude”, “lat”
  - longitude: “longitude”, “lng”, “lon”
  - lookup: “lookup”
- **Coords** specifies that your query holds coordinate data. You will be prompted to select numeric data fields for latitude and longitude from your database query.
- **Geohash** specifies that your query holds geohash data. You will be prompted to select a string data field for geohash from your database query.
- **Lookup** specifies that your query holds location name data that needs to be mapped to a value. You will be prompted to select the lookup field from your database query and a gazetteer. The gazeteer is the directory that will be used to map your queried data to a geographical point.

### Markers Layer

![Markers Layer](/static/img/docs/geomap-panel/geomap_markers_layer.png)

Markers layer allows displaying data points as different marker shapes such as circle, square, triangle, star, and more.

![Markers Layer Options](/static/img/docs/geomap-panel/geomap_markers_options.png)

- **Marker Color** configures the color of the marker. The default `Fixed size` keeps all points a single color. There is an alternate option to have multiple colors depending on the data point values and the threshold set at the `Thresholds` section.
- **Marker Size** configures the size of the marker. Default is `Fixed size`, making all marker size the same regardless of the data points. However, there is also an option to scale the circles to the corresponding data points. `Min` and `Max` marker size has to be set such that the Marker layer can scale within these range.
- **Marker Shape** gives flexibility to visualize the data points differently. 
  - Circle
  - Square
  - Triangle
  - Star
  - Cross
  - X
- **Fill Opacity** configures the transparency of each marker.

### Heatmap Layer

![Heatmap Layer](/static/img/docs/geomap-panel/geomap_heatmap_layer.png)

Heatmap layer cluster data points to visualize locations with different densities. To add a heatmap layer, click on the drop down menu under Data Layer and choose `Heatmap`. Similar to `Markers`, you will be prompted with various options determine which data points to visualize and how. 

![Heatmap Layer Options](/static/img/docs/geomap-panel/geomap_heatmap_options.png)

- **Weight values** configures the intensity of the heatmap clusters. `Fixed value` keeps a constant weight value throughout all data points. This value should be in the range of 0~1. Similar to Markers, there is an alternate option in the drop down to automatically scale the weight values depending on data values.
- **Radius** configures the size of the heatmap clusters.
- **Blur** configures the amount of blur on each cluster.