import LayerGroup from 'ol/layer/Group';
import Layer from 'ol/layer/Layer';
import VectorLayer from 'ol/layer/Vector';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorSource from 'ol/source/Vector';
import { apply } from 'ol-mapbox-style';

import { type MapLayerRegistryItem } from '@grafana/data';

// https://docs.carto.com/faqs/carto-basemaps

const ATTRIBUTION = `<a href="https://carto.com/attribution/">©CARTO</a> <a href="https://www.openstreetmap.org/copyright">©OpenStreetMap</a> contributors`;

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

/**
 * CARTO's 512px tiles run out one level short of the view's own zoom 0, so further out every style
 * rule falls below the style's first zoom stop and the basemap collapses to its background color.
 * Styling those resolutions as if they were the widest tile keeps the world drawn, only smaller.
 */
function clampStyleToWidestTile(layer: VectorTileLayer) {
  const tileGrid = layer.getSource()?.getTileGrid();
  const styleFunction = layer.getStyleFunction();
  if (!tileGrid || !styleFunction) {
    return;
  }
  const widest = tileGrid.getResolution(tileGrid.getMinZoom());
  layer.setStyle((feature, resolution) => styleFunction(feature, Math.min(resolution, widest)));
}

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
      // The style's own attribution is two chained requests away, so an empty source carries it from
      // the first render instead, the way the raster source used to.
      const attribution = new VectorLayer({ source: new VectorSource({ attributions: ATTRIBUTION }) });
      const layer = new LayerGroup({ layers: [attribution] });

      // CARTO serves every style with the same id and ol-mapbox-style caches paint functions per id,
      // so without a unique one the first basemap on the page repaints all the others.
      fetch(styleUrl)
        .then((response) => response.json())
        .then((glStyle) => apply(layer, { ...glStyle, id: styleUrl }, { styleUrl }))
        .then(() =>
          layer.getLayers().forEach((child) => {
            // The TileJSON credits the same two projects in its own words, so drop it and keep one
            if (child !== attribution && child instanceof Layer) {
              child.getSource()?.setAttributions(undefined);
            }
            if (child instanceof VectorTileLayer) {
              clampStyleToWidestTile(child);
            }
          })
        )
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
