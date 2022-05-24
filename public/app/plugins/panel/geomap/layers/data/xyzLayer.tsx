import {
  // FieldType,
  // getFieldColorModeForField,
  // GrafanaTheme2,
  MapLayerOptions,
  MapLayerRegistryItem,
  // PanelData,
} from '@grafana/data';
import Map from 'ol/Map';
// import * as layer from 'ol/layer';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

// Configuration options for XYZ overlays
export interface XYZConfig {
  url: string;
  attribution: string;
}

const sampleURL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
export const defaultXYZConfig: XYZConfig = {
  url: sampleURL + '/tile/{z}/{y}/{x}',
  attribution: `Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors`,
};

export const xyzLayer: MapLayerRegistryItem<XYZConfig> = {
  id: 'xyzlayer',
  name: 'XYZ Data Layer',
  description: 'Adds an xyz map overlay to the map',
  isBaseMap: false,

  create: async (map: Map, options: MapLayerOptions<XYZConfig>) => ({
    init: () => {
      const cfg = { ...options.config };
      if (!cfg.url) {
        cfg.url = defaultXYZConfig.url;
        cfg.attribution = cfg.attribution ?? defaultXYZConfig.attribution;
      }
      return new TileLayer({
        source: new XYZ({
          url: cfg.url,
          attributions: cfg.attribution, // singular?
        }),
      });
    },
    registerOptionsUI: (builder) => {
      builder
        .addTextInput({
          path: 'config.url',
          name: 'URL template',
          description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
          settings: {
            placeholder: defaultXYZConfig.url,
          },
        })
        .addTextInput({
          path: 'config.attribution',
          name: 'Attribution',
          settings: {
            placeholder: defaultXYZConfig.attribution,
          },
        });
    },
  })
}
