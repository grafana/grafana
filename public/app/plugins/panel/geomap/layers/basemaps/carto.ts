import Map from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import { MapLayerRegistryItem, MapLayerOptions, GrafanaTheme2, EventBus } from '@grafana/data';

// https://carto.com/help/building-maps/basemap-list/

export enum LayerTheme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export interface CartoConfig {
  theme?: LayerTheme;
  showLabels?: boolean;
}

export const defaultCartoConfig: CartoConfig = {
  theme: LayerTheme.Auto,
  showLabels: true,
};

export const carto: MapLayerRegistryItem<CartoConfig> = {
  id: 'carto',
  name: 'CARTO basemap',
  description: 'Add layer CARTO Raster basemaps',
  isBaseMap: true,
  defaultOptions: defaultCartoConfig,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<CartoConfig>, eventBus: EventBus, theme: GrafanaTheme2) => ({
    init: () => {
      const cfg = { ...defaultCartoConfig, ...options.config };
      let style = cfg.theme as string;
      if (!style || style === LayerTheme.Auto) {
        style = theme.isDark ? 'dark' : 'light';
      }
      if (cfg.showLabels) {
        style += '_all';
      } else {
        style += '_nolabels';
      }
      return new TileLayer({
        source: new XYZ({
          attributions: `<a href="https://carto.com/attribution/">© CARTO</a>`,
          url: `https://{1-4}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`,
        }),
      });
    },

    registerOptionsUI: (builder) => {
      builder
        .addRadio({
          path: 'config.theme',
          name: 'Theme',
          settings: {
            options: [
              { value: LayerTheme.Auto, label: 'Auto', description: 'Match grafana theme' },
              { value: LayerTheme.Light, label: 'Light' },
              { value: LayerTheme.Dark, label: 'Dark' },
            ],
          },
          defaultValue: defaultCartoConfig.theme!,
        })
        .addBooleanSwitch({
          path: 'config.showLabels',
          name: 'Show labels',
          description: '',
          defaultValue: defaultCartoConfig.showLabels,
        });
    },
  }),
};

export const cartoLayers = [carto];
