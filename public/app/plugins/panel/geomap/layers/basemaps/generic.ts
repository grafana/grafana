import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';

import {
  type MapLayerRegistryItem,
  type MapLayerOptions,
  type PanelOptionsEditorBuilder,
  textUtil,
} from '@grafana/data';
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

/** A layer config whose XYZ fields are still unset, as saved panel options have them. */
export type UnresolvedXYZConfig<T extends XYZConfig = XYZConfig> = Omit<T, keyof XYZConfig> & Partial<XYZConfig>;

/** The same config once the XYZ fields are guaranteed present. */
type ResolvedXYZConfig<T extends XYZConfig = XYZConfig> = Omit<T, keyof XYZConfig> & XYZConfig;

/**
 * Saved panel options are only ever partial, so fill in the gaps once here with defaults if needed
 * and let everything downstream work with a complete config.
 */
export function resolveXYZConfig<T extends XYZConfig = XYZConfig>(
  config: UnresolvedXYZConfig<T>
): ResolvedXYZConfig<T> {
  if (!config.url) {
    return {
      ...config,
      url: defaultXYZConfig.url,
      attribution: config.attribution ?? defaultXYZConfig.attribution,
    };
  }
  return { ...config, url: config.url, attribution: config.attribution ?? '' };
}

const registerOptionsUI = (builder: PanelOptionsEditorBuilder<MapLayerOptions<Partial<XYZConfig>>>) => {
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
};

export const xyzTiles: MapLayerRegistryItem<UnresolvedXYZConfig<XYZConfig>> = {
  id: 'xyz',
  name: 'XYZ Tile layer',
  description: 'Add map from a generic tile layer',
  isBaseMap: true,

  create: async (_map, options, _eventBus, _theme) => ({
    init: () => {
      const cfg = resolveXYZConfig(options.config ?? {});
      const noRepeat = options.noRepeat ?? false;
      const interpolatedUrl = textUtil.sanitizeUrl(getTemplateSrv().replace(cfg.url));
      const interpolatedAttribution = textUtil.sanitizeTextPanelContent(getTemplateSrv().replace(cfg.attribution));

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
    registerOptionsUI,
  }),
};

export const genericLayers = [xyzTiles];
