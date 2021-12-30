import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
} from '@grafana/data';
import Map from 'ol/Map';
import Feature, { FeatureLike } from 'ol/Feature';
import { Geometry } from 'ol/geom';
import * as source from 'ol/source';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
import { getColorDimension } from 'app/features/dimensions';
import { getFeaturesLineString } from '../../utils/getFeatures';
import { defaultStyleConfig, StyleConfig, StyleDimensions } from '../../style/types';
import { StyleEditor } from './StyleEditor';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { isNumber } from 'lodash';
import { routeStyle } from '../../style/markers';

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
  tooltip: true,
};

/**
 * Map layer configuration for circle overlay
 */
export const routeLayer: MapLayerRegistryItem<RouteConfig> = {
  id: ROUTE_LAYER_ID,
  name: 'Route',
  description: 'use route to render data point as a route',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<RouteConfig>, theme: GrafanaTheme2) => {
    const matchers = await getLocationMatchers(options.location);
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);

    // eventually can also use resolution for dynamic style
    const vectorLayer = new VectorLayer();

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

        const features: Feature<Geometry>[] = [];

        for (const frame of data.series) {
          const info = dataFrameToPoints(frame, matchers);
          if (info.warning) {
            console.log('Could not find locations', info.warning);
            continue; // ???
          }

          if (style.fields) {
            const dims: StyleDimensions = {};
            if (style.fields.color) {
              dims.color = getColorDimension(frame, style.config.color ?? defaultStyleConfig.color, theme);
            }
            style.dims = dims;
          }

          const frameFeatures = getFeaturesLineString(frame, info);

          if (frameFeatures) {
            features.push(...frameFeatures);
          }

          break; // Only the first frame for now!
        }

        // Source reads the data and provides a set of features to visualize
        const vectorSource = new source.Vector({ features });
        vectorLayer.setSource(vectorSource);
      },

      // Marker overlay options
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
