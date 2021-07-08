import { MapLayerRegistryItem, MapLayerConfig, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

export interface XYZConfig {
  url: string;
  attribution: string;
  minZoom?: number;
  maxZoom?: number;
}

const sampleURL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer';
export const defaultXYZConfig: XYZConfig = {
  url: sampleURL + '/tile/{z}/{y}/{x}',
  attribution: `Tiles © <a href="${sampleURL}">ArcGIS</a>`,
};

export const xyzTiles: MapLayerRegistryItem<XYZConfig> = {
  id: 'xyz',
  name: 'XYZ Tile layer',
  isBaseMap: true,

  create: (map: Map, options: MapLayerConfig<XYZConfig>, theme: GrafanaTheme2) => ({
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
        minZoom: cfg.minZoom,
        maxZoom: cfg.maxZoom,
      });
    },
  }),

  registerOptionsUI: (builder) => {
    builder
      .addTextInput({
        path: 'url',
        name: 'URL template',
        description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
        settings: {
          placeholder: defaultXYZConfig.url,
        },
      })
      .addTextInput({
        path: 'attribution',
        name: 'Attribution',
        settings: {
          placeholder: defaultXYZConfig.attribution,
        },
      });
  },
};

export const genericLayers = [xyzTiles];
