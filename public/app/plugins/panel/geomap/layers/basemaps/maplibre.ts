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

interface ExtendedMapLayerOptions<T> extends MapLayerOptions<T> {
  noRepeat?: boolean;
}

export const maplibreLayer: MapLayerRegistryItem<MaplibreConfig> = {
  id: 'maplibre',
  name: 'MapLibre layer',
  description: 'Add layer using MapLibre style.json URL',
  isBaseMap: true,

  create: async (
    map: Map,
    options: ExtendedMapLayerOptions<MaplibreConfig>,
    eventBus: EventBus,
    theme: GrafanaTheme2
  ) => ({
    init: () => {
      const cfg = { ...options.config };
      if (!cfg.url) {
        cfg.url = defaultMaplibreConfig.url;
      }
      const layerOpacity = options.opacity ?? 1;
      const noRepeat = options.noRepeat ?? false;
      const layer = new LayerGroup({
        opacity: layerOpacity,
      });

      const applyNoRepeat = () => {
        if (noRepeat) {
          // Set wrapX: false on the first layer source to prevent world repetition
          const firstLayer = layer.getLayers().item(0);
          if (firstLayer && 'getSource' in firstLayer && typeof firstLayer.getSource === 'function') {
            const source = firstLayer.getSource();
            if (source && 'setWrapX' in source && typeof source.setWrapX === 'function') {
              source.setWrapX(false);
            }
          }
        }
      };

      // Handle async operations in the background
      const loadStyle = async () => {
        try {
          if (!cfg.url) {
            console.warn('No URL provided for MapLibre style, layer will be empty');
            return;
          }

          const res = await fetch(cfg.url);
          if (!res.ok) {
            console.warn(`Failed to load MapLibre style from ${cfg.url}: ${res.status} ${res.statusText}`);
            // Try fallback approach
            await tryFallbackApply();
            return;
          }

          const style = await res.json();

          // Adjust background opacity - let LayerGroup opacity handle everything else
          if (Array.isArray(style?.layers)) {
            for (const l of style.layers) {
              if (l && l.type === LAYER_TYPE_BACKGROUND) {
                l.paint = l.paint || {};
                l.paint[PAINT_BACKGROUND_OPACITY] = layerOpacity;
              }
            }
          }

          await apply(layer, style, { styleUrl: cfg.url, accessToken: cfg.accessToken });
          applyNoRepeat();
        } catch (error) {
          console.warn('Failed to parse or apply MapLibre style JSON:', error);
          // Try fallback approach
          await tryFallbackApply();
        }
      };

      const tryFallbackApply = async () => {
        try {
          if (!cfg.url) {
            console.warn('No URL available for MapLibre fallback, layer will be empty');
            return;
          }
          await apply(layer, cfg.url, { accessToken: cfg.accessToken });
          applyNoRepeat();
        } catch (fallbackError) {
          console.warn('Failed to load MapLibre style from both JSON and direct URL approaches:', fallbackError);
        }
      };

      // Start loading the style asynchronously
      loadStyle();

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
