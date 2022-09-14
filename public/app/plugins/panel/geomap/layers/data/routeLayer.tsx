import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  FrameGeometrySourceMode,
  PluginState,
  EventBus,
  DataHoverEvent,
  DataHoverClearEvent,
  DataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';
import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { Subscription, throttleTime } from 'rxjs';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { getColorDimension } from 'app/features/dimensions';
import { defaultStyleConfig, StyleConfig, StyleDimensions } from '../../style/types';
import { StyleEditor } from '../../editor/StyleEditor';
import { getStyleConfigState } from '../../style/utils';
import VectorLayer from 'ol/layer/Vector';
import { isNumber } from 'lodash';
import { routeStyle } from '../../style/markers';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { Group as LayerGroup } from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import Feature from 'ol/Feature';
import { alpha } from '@grafana/data/src/themes/colorManipulator';

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
    const vectorLayer = new VectorLayer({ source });

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

    // Crosshair layer
    const crosshairFeature = new Feature({});
    const crosshairRadius = (style.base.lineWidth || 6) + 2;
    const crosshairStyle = new Style({
      image: new Circle({
        radius: crosshairRadius,
        stroke: new Stroke({
          color: alpha(style.base.color, 0.4),
          width: crosshairRadius + 2
        }),
        fill: new Fill({color: style.base.color}),
      })
    });

    const crosshairLayer = new VectorLayer({
      source: new VectorSource({
        features: [crosshairFeature],
      }),
      style: crosshairStyle,
    });

    const layer = new LayerGroup({
      layers: [vectorLayer, crosshairLayer]
    });

    // Crosshair sharing subscriptions
    const subscriptions = new Subscription();

    subscriptions.add(
      eventBus
        .getStream(DataHoverEvent)
        .pipe(throttleTime(8))
        .subscribe({
          next: (event) => {
            const feature = source.getFeatures()[0];
            const frame = feature?.get('frame') as DataFrame;
            const time = event.payload?.point?.time as number;
            if (frame && time) {
              const timeField = frame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
              if (timeField) {
                const timestamps: number[] = timeField.values.toArray();
                const pointIdx = findNearestTimeIndex(timestamps, time);
                if (pointIdx !== null) {
                  const out = getGeometryField(frame, location);
                  if (out.field) {
                    crosshairFeature.setGeometry(out.field.values.get(pointIdx));
                    crosshairFeature.setStyle(crosshairStyle);
                  }
                }
              }
            }
          },
        })
    );

    subscriptions.add(
      eventBus.subscribe(DataHoverClearEvent, (event) => {
        crosshairFeature.setStyle(new Style({}));
      })
    );

    return {
      init: () => layer,
      dispose: () => subscriptions.unsubscribe(),
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

function findNearestTimeIndex(timestamps: number[], time: number): number | null {
  if (timestamps.length === 0) {
    return null;
  } else if (timestamps.length === 1) {
    return 0;
  }
  const lastIdx = timestamps.length - 1;
  if (time < timestamps[0]) {
    return 0;
  } else if (time > timestamps[lastIdx]) {
    return lastIdx;
  }

  const probableIdx = Math.abs(Math.round(lastIdx * (time - timestamps[0]) / (timestamps[lastIdx] - timestamps[0])));
  if (time < timestamps[probableIdx]) {
    for (let i = probableIdx; i > 0; i--) {
      if (time > timestamps[i]) {
        return i;
      }
    }
    return 0;
  } else {
    for (let i = probableIdx; i < lastIdx; i++) {
      if (time < timestamps[i]) {
        return i;
      }
    }
    return lastIdx;
  }
}
