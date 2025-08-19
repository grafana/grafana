import Map from 'ol/Map';
import LayerGroup from 'ol/layer/Group';
import { apply } from 'ol-mapbox-style';

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus } from '@grafana/data';

// MapLibre Style Specification constants
const LAYER_TYPE_BACKGROUND = 'background';
const PAINT_BACKGROUND_OPACITY = 'background-opacity';

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
  name: 'MapLibre layer',
  description: 'Add layer using MapLibre style.json URL',
  isBaseMap: true,

  create: async (map: Map, options: MapLayerOptions<MaplibreConfig>, eventBus: EventBus, theme: GrafanaTheme2) => ({
    init: () => {
      const cfg = { ...options.config };
      if (!cfg.url) {
        cfg.url = defaultMaplibreConfig.url;
      }
      const layerOpacity = options.opacity ?? 1;
      const layer = new LayerGroup({
        opacity: layerOpacity,
      });

      fetch(cfg.url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load style'))))
        .then((style) => {
          // Adjust background opacity - let LayerGroup opacity handle everything else
          if (Array.isArray(style?.layers)) {
            for (const l of style.layers) {
              if (l && l.type === LAYER_TYPE_BACKGROUND) {
                l.paint = l.paint || {};
                l.paint[PAINT_BACKGROUND_OPACITY] = layerOpacity;
              }
            }
          }
          return apply(layer, style, { styleUrl: cfg.url, accessToken: cfg.accessToken });
        })
        .catch(() => apply(layer, cfg.url, { accessToken: cfg.accessToken }));

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
