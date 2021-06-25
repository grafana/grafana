import { MapLayerRegistryItem, MapLayerConfig } from '@grafana/data';

import TileLayer from 'ol/layer/Tile';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';

export interface EsriLayerOptions {
  token?: string;
}

// Streets
// Topographic
// NationalGeographic
// Oceans
// Gray
// DarkGray
// Imagery
// ImageryClarity (added in 2.1.3)
// ImageryFirefly (added in 2.2.0)
// ShadedRelief
// Terrain
// USATopo (added in 2.0.0)
// Physical (added in 2.2.0)

// https://services.arcgisonline.com/arcgis/rest/services
export const esriLayers = [
  { name: 'World Street Map', service: 'World_Street_Map' },
  { name: 'World Imagery', service: 'World_Imagery' },
  { name: 'World Physical Map', service: 'World_Physical_Map' },
  { name: 'World Dark Grey', service: 'Canvas/World_Dark_Gray_Base' },
  { name: 'World Light Grey', service: 'Canvas/World_Light_Gray_Base' },
].map((info) => ({
  id: `esri-${info.service}`,
  name: `ESRI ${info.name}`,
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<EsriLayerOptions>) => ({
    init: () => {
      return new TileLayer({
        source: new XYZ({
          attributions: `Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/${info.service}/MapServer">ArcGIS</a>`,
          url: `https://server.arcgisonline.com/ArcGIS/rest/services/${info.service}/MapServer/tile/{z}/{y}/{x}`,
        }),
      });
    },
  }),
}));
