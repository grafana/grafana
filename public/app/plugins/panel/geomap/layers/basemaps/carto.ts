import LayerGroup from 'ol/layer/Group';
import { apply } from 'ol-mapbox-style';

import { type MapLayerRegistryItem } from '@grafana/data';

// https://docs.carto.com/faqs/carto-basemaps

export enum LayerTheme {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export interface CartoConfig {
  theme?: LayerTheme;
  showLabels?: boolean;
}

const defaultCartoConfig: CartoConfig = {
  theme: LayerTheme.Auto,
  showLabels: true,
};

export const carto: MapLayerRegistryItem<CartoConfig> = {
  id: 'carto',
  name: 'CARTO basemap',
  description: 'Add layer CARTO vector basemaps',
  isBaseMap: true,
  requiresAttribution: true,
  defaultOptions: defaultCartoConfig,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (_map, options, _eventBus, theme) => ({
    init: () => {
      const cfg = { ...defaultCartoConfig, ...options.config };
      const dark = !cfg.theme || cfg.theme === LayerTheme.Auto ? theme.isDark : cfg.theme === LayerTheme.Dark;
      const style = `${dark ? 'dark-matter' : 'positron'}${cfg.showLabels ? '' : '-nolabels'}`;
      const styleUrl = `https://basemaps.cartocdn.com/gl/${style}-gl-style/style.json`;
      const layer = new LayerGroup();

      // CARTO serves every style with the same id and ol-mapbox-style caches paint functions per id,
      // so without a unique one the first basemap on the page repaints all the others.
      fetch(styleUrl)
        .then((response) => response.json())
        .then((glStyle) => apply(layer, { ...glStyle, id: styleUrl }, { styleUrl }))
        .catch((error) => console.warn('Failed to load CARTO basemap style:', error));

      return layer;
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
