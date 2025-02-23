import Map from 'ol/Map';
import LayerGroup from 'ol/layer/Group';
import { apply } from 'ol-mapbox-style';

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus } from '@grafana/data';

export interface MaplibreConfig {
  url: string;
  accessToken?: string;
}

const sampleURL = 'https://tiles.stadiamaps.com/styles/alidade_smooth.json';

export const defaultMaplibreConfig: MaplibreConfig = {
  url: sampleURL,
};

export const maplibreLayer: MapLayerRegistryItem<MaplibreConfig> = {
  id: 'maplibre',
  name: 'MapLibre Style layer',
  description: 'Add a map using Mapbox / MapLibre style.json URL',
  isBaseMap: true,

  create: async (map: Map, options: MapLayerOptions<MaplibreConfig>, eventBus: EventBus, theme: GrafanaTheme2) => ({
    init: () => {
      const cfg = { ...options.config };
      if (!cfg.url) {
        cfg.url = defaultMaplibreConfig.url;
      }

      const layer = new LayerGroup();
      apply(layer, cfg.url, { accessToken: cfg.accessToken });

      return layer;
    },
    registerOptionsUI: (builder) => {
      builder
        .addTextInput({
          path: 'config.url',
          name: 'URL template',
          description: 'URL to the styles.json file.',
          settings: {
            placeholder: defaultMaplibreConfig.url,
          },
        })
        .addTextInput({
          path: 'config.accessToken',
          name: 'Access Token',
          description: 'Token for mapbox:// urls',
          settings: {
            placeholder: '',
          },
        });
    },
  }),
};

export const maplibreLayers = [maplibreLayer];
