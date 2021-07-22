+++
title = "Geomap"
description = "Geomap visualization documentation"
keywords = ["grafana", "Geomap", "panel", "documentation"]
aliases =["/docs/grafana/latest/features/panels/geomap/"]
weight = 600
+++

# Geomap

The Geomap panel visualization allows you to view and customize the world map using geospatial data in respect to geographical locations. Various overlay styles and map view settings can be configured to easily focus on the important location-based characteristics of the data.


## Base layer

Base layer loads in a blank world map from the tile server to the Grafana panel. There are several base layer options currently available for you to choose from, each with their specific configuration options to style the base map. Default base layer is automatically set to use CartoDB base map, but can be specified through the `.ini` configuration file.

### Configure the default base layer with provisioning

It is possible to configure the default base map using config files with Grafana’s provisioning system. You can read more about how it works and all the settings you can set on the [provisioning docs page]({{< relref "../administration/provisioning/#datasources" >}}).

`default_baselayer_config` is the JSON configuration used to define the default base map. There are currently four base map options to choose from: `carto`, `esri-xyz`, `osm-standard`, `xyz`. Here are some provisioning examples for each base map options.

- **carto -** loads the CartoDB tile server. There is a choice between `auto`, `dark`, and `light` theme for the base map and can be set correspondingly as shown below. `showLabels` tag determines whether or not to show the Country details on top of the map.

```ini
geomap_default_baselayer = `{
  "type": "carto",
  "config": {
    "theme": "auto",
    "showLabels": true
  }
}`
```

- **esri-xyz -** loads the ESRI tile server. There are already multiple server instances implemented to show the various map styles: `world-imagery`, `world-physical`, `topo`, `usa-topo`, and `ocean`. There is also a `custom` server option which allows to configure your own ArcGIS map server.

```ini
geomap_default_baselayer = `{
  "type": "esri-xyz",
  "config": {
    "server": "world-imagery"
  }
}`

geomap_default_baselayer = `{   
  "type": "esri-xyz",
  "config": {
    "server": "custom",
    "url": "[tile server url]",
    "attribution": "[tile server attribution]"
  }
}`
```

- **osm-standard -** loads the OpenStreetMap tile server. There is no additional `config` fields needed to be set and can be left blank. 

```ini
default_baselayer_config = `{
  "type": "osm-standard",
  "config": {}
}`
```

- **xyz -** loads a custom tile server defined by the user.  A valid tile server `url`, with {z}/{x}/{y}, has to be set in order for this option to properly load a default base map.

```ini
default_baselayer_config = `{
  "type": "xyz",
  "config": {
    "attribution": "Open street map",
    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  }
}`
```

## Data layer