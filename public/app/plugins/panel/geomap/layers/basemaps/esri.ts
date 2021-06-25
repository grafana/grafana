import { MapLayerConfig } from '@grafana/data';

import TileLayer from 'ol/layer/Tile';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';

// https://services.arcgisonline.com/arcgis/rest/services
export const esriLayers = [
  { name: 'Streets', service: 'World_Street_Map' },
  { name: 'Topographic', service: 'World_Topo_Map' },
  { name: 'World Imagery', service: 'World_Imagery' },
  { name: 'World Physical Map', service: 'World_Physical_Map' },
  { name: 'World Dark Grey', service: 'Canvas/World_Dark_Gray_Base' },
  { name: 'World Light Grey', service: 'Canvas/World_Light_Gray_Base' },
  { name: 'National Geographic', service: 'USA_Topo_Maps' },
].map((info) => ({
  id: `esri-${info.service}`,
  name: `ESRI ${info.name}`,
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig) => ({
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
