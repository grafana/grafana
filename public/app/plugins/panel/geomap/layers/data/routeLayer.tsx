import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  PluginState,
  EventBus,
} from '@grafana/data';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import { getColorDimension } from 'app/features/dimensions';
import { defaultStyleConfig, StyleConfig, StyleDimensions } from '../../style/types';
import { StyleEditor } from './StyleEditor';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { isNumber } from 'lodash';
import { routeStyle } from '../../style/markers';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';

// Configuration options for Circle overlays
export interface RouteConfig {
  style: StyleConfig;
}

const defaultOptions: RouteConfig = {
  style: {
    ...defaultStyleConfig,
    opacity: 1,
    lineWidth: 2,
  },
};

export const ROUTE_LAYER_ID = 'route';

// Used by default when nothing is configured
export const defaultRouteConfig: MapLayerOptions<RouteConfig> = {
  type: ROUTE_LAYER_ID,
  name: '', // will get replaced
  config: defaultOptions,
  location: {
    mode: FrameGeometrySourceMode.Auto,
  },
  tooltip: false,
};

/**
 * Map layer configuration for circle overlay
 */
export const routeLayer: MapLayerRegistryItem<RouteConfig> = {
  id: ROUTE_LAYER_ID,
  name: 'Route',
  description: 'Render data points as a route',
  isBaseMap: false,
  showLocation: true,
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<RouteConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorLayer({
      source,
    });

    if (!style.fields) {
      // Set a global style
      vectorLayer.setStyle(routeStyle(style.base));
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx = feature.get('rowIndex') as number;
        const dims = style.dims;
        if (!dims || !isNumber(idx)) {
          return routeStyle(style.base);
        }

        const values = { ...style.base };

        if (dims.color) {
          values.color = dims.color.get(idx);
        }
        return routeStyle(values);
      });
    }

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          return; // ignore empty
        }

        for (const frame of data.series) {
          if (style.fields) {
            const dims: StyleDimensions = {};
            if (style.fields.color) {
              dims.color = getColorDimension(frame, style.config.color ?? defaultStyleConfig.color, theme);
            }
            style.dims = dims;
          }

          source.updateLineString(frame);
          break; // Only the first frame for now!
        }
      },

      // Route layer options
      registerOptionsUI: (builder) => {
        builder
          .addCustomEditor({
            id: 'config.style',
            path: 'config.style',
            name: 'Style',
            editor: StyleEditor,
            settings: {
              simpleFixedValues: true,
            },
            defaultValue: defaultOptions.style,
          })
          .addSliderInput({
            path: 'config.style.lineWidth',
            name: 'Line width',
            defaultValue: defaultOptions.style.lineWidth,
            settings: {
              min: 1,
              max: 10,
              step: 1,
            },
          });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
