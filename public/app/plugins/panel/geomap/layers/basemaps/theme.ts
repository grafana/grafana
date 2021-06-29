import { MapLayerRegistryItem, MapLayerConfig, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';

export const defaultGrafanaThemedMap: MapLayerRegistryItem = {
  id: 'grafana-theme',
  name: 'Grafana - based on theme',
  isBaseMap: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig, theme: GrafanaTheme2) => ({
    init: () => {
      return new TileLayer({
        source: new XYZ({
          attributions: `<a href="https://carto.com/about-carto/">CARTO</a>`,
          url: theme.isDark
            ? `https://{1-4}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`
            : `https://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
        }),
      });
    },
  }),
};
