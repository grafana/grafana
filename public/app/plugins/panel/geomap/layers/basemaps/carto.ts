import { MapLayerRegistryItem, MapLayerConfig, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

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
  name: 'CARTO reference map',
  isBaseMap: true,
  defaultOptions: defaultCartoConfig,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<CartoConfig>, theme: GrafanaTheme2) => ({
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
  }),

  registerOptionsUI: (builder) => {
    builder
      .addRadio({
        path: 'theme',
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
        path: 'showLabels',
        name: 'Show labels',
        description: '',
        defaultValue: defaultCartoConfig.showLabels,
      });
  },
};

export const cartoLayers = [carto];
