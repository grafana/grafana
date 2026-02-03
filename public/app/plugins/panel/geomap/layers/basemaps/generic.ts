import OpenLayersMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

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
  description: 'Add map from a generic tile layer',
  isBaseMap: true,

  create: async (
    map: OpenLayersMap,
    options: MapLayerOptions<XYZConfig>,
    eventBus: EventBus,
    theme: GrafanaTheme2
  ) => ({
    init: () => {
      const cfg = { ...options.config };
      if (!cfg.url) {
        cfg.url = defaultXYZConfig.url;
        cfg.attribution = cfg.attribution ?? defaultXYZConfig.attribution;
      }
      const noRepeat = options.noRepeat ?? false;
      const interpolatedUrl = getTemplateSrv().replace(cfg.url);
      const interpolatedAttribution = getTemplateSrv().replace(cfg.attribution);

      return new TileLayer({
        source: new XYZ({
          url: interpolatedUrl,
          attributions: interpolatedAttribution,
          wrapX: !noRepeat,
          minZoom: cfg.minZoom,
          maxZoom: cfg.maxZoom,
        }),
        minZoom: cfg.minZoom,
      });
    },
    registerOptionsUI: (builder) => {
      builder
        .addTextInput({
          path: 'config.url',
          name: 'URL template',
          description: 'Must include {x}, {y} or {-y}, and {z} placeholders. Dashboard variables are supported.',
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
        })
        .addNumberInput({
          path: 'config.minZoom',
          name: 'Min zoom',
          description: 'Minimum zoom level. Tiles are not loaded below this level.',
          settings: {
            placeholder: '0',
            min: 0,
            max: 30,
          },
        })
        .addNumberInput({
          path: 'config.maxZoom',
          name: 'Max zoom',
          description: 'Maximum zoom level provided by the server. Beyond this level, tiles are upscaled.',
          settings: {
            placeholder: '18',
            min: 0,
            max: 30,
          },
        });
    },
  }),
};

export const genericLayers = [xyzTiles];
