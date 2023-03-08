import {
  MapLayerRegistryItem,
  PanelData,
  GrafanaTheme2,
  PluginState,
  EventBus,
  DataHoverEvent,
  DataHoverClearEvent,
  DataFrame,
  TIME_SERIES_TIME_FIELD_NAME,
} from '@grafana/data';

import { MapLayerOptions, FrameGeometrySourceMode } from '@grafana/schema';

import Map from 'ol/Map';
import { FeatureLike } from 'ol/Feature';
import { Subscription, throttleTime } from 'rxjs';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
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
import { LineString, Point, SimpleGeometry } from 'ol/geom';
import FlowLine from 'ol-ext/style/FlowLine';
import tinycolor from 'tinycolor2';
import { getStyleDimension, isSegmentVisible } from '../../utils/utils';

// Configuration options for Circle overlays
export interface RouteConfig {
  style: StyleConfig;
  arrow?: 0 | 1 | -1;
}

const defaultOptions: RouteConfig = {
  style: {
    ...defaultStyleConfig,
    opacity: 1,
    lineWidth: 2,
  },
  arrow: 0,
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
    const hasArrows = config.arrow == 1 || config.arrow == -1;

    if (!style.fields && !hasArrows) {
      // Set a global style
      const styleBase = routeStyle(style.base);
      if (style.config.size && style.config.size.fixed) {
        // Applies width to base style if specified
        styleBase.getStroke().setWidth(style.config.size.fixed);
      }
      vectorLayer.setStyle(styleBase);
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx = feature.get('rowIndex') as number;
        const dims = style.dims;
        if (!dims || !isNumber(idx)) {
          return routeStyle(style.base);
        }

        const styles = [];
        const geom = feature.getGeometry();
        const opacity = style.config.opacity ?? 1;
        if (geom instanceof SimpleGeometry) {
          const coordinates = geom.getCoordinates();
          if (coordinates) {
            let startIndex = 0; // Index start for segment optimization
            const pixelTolerance = 2; // For segment to be visible, it must be > 2 pixels (due to round ends)
            for (let i = 0; i < coordinates.length - 1; i++) {
              const segmentStartCoords = coordinates[startIndex];
              const segmentEndCoords = coordinates[i + 1];
              const color1 = tinycolor(
                theme.visualization.getColorByName((dims.color && dims.color.get(startIndex)) ?? style.base.color)
              )
                .setAlpha(opacity)
                .toString();
              const color2 = tinycolor(
                theme.visualization.getColorByName((dims.color && dims.color.get(i + 1)) ?? style.base.color)
              )
                .setAlpha(opacity)
                .toString();

              const arrowSize1 = (dims.size && dims.size.get(startIndex)) ?? style.base.size;
              const arrowSize2 = (dims.size && dims.size.get(i + 1)) ?? style.base.size;

              const flowStyle = new FlowLine({
                visible: true,
                lineCap: config.arrow == 0 ? 'round' : 'square',
                color: color1,
                color2: color2,
                width: (dims.size && dims.size.get(startIndex)) ?? style.base.size,
                width2: (dims.size && dims.size.get(i + 1)) ?? style.base.size,
              });
              if (config.arrow) {
                flowStyle.setArrow(config.arrow);
                if (config.arrow > 0) {
                  flowStyle.setArrowColor(color2);
                  flowStyle.setArrowSize((arrowSize2 ?? 0) * 1.5);
                } else {
                  flowStyle.setArrowColor(color1);
                  flowStyle.setArrowSize((arrowSize1 ?? 0) * 1.5);
                }
              }
              // Only render segment if change in pixel coordinates is significant enough
              if (isSegmentVisible(map, pixelTolerance, segmentStartCoords, segmentEndCoords)) {
                const LS = new LineString([segmentStartCoords, segmentEndCoords]);
                flowStyle.setGeometry(LS);
                styles.push(flowStyle);
                startIndex = i + 1; // Because a segment was created, move onto the next one
              }
            }
            // If no segments created, render a single point
            if (styles.length === 0) {
              const P = new Point(coordinates[0]);
              const radius = ((dims.size && dims.size.get(0)) ?? style.base.size ?? 10) / 2;
              const color = tinycolor(
                theme.visualization.getColorByName((dims.color && dims.color.get(0)) ?? style.base.color)
              )
                .setAlpha(opacity)
                .toString();
              const ZoomOutCircle = new Style({
                image: new Circle({
                  radius: radius,
                  fill: new Fill({
                    color: color,
                  }),
                }),
              });
              ZoomOutCircle.setGeometry(P);
              styles.push(ZoomOutCircle);
            }
          }
          return styles;
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
          width: crosshairRadius + 2,
        }),
        fill: new Fill({ color: style.base.color }),
      }),
    });

    const crosshairLayer = new VectorLayer({
      source: new VectorSource({
        features: [crosshairFeature],
      }),
      style: crosshairStyle,
    });

    const layer = new LayerGroup({
      layers: [vectorLayer, crosshairLayer],
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
          if (style.fields || hasArrows) {
            style.dims = getStyleDimension(frame, style, theme);
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
              simpleFixedValues: false,
            },
            defaultValue: defaultOptions.style,
          })
          .addRadio({
            path: 'config.arrow',
            name: 'Arrow',
            settings: {
              options: [
                { label: 'None', value: 0 },
                { label: 'Forward', value: 1 },
                { label: 'Reverse', value: -1 },
              ],
            },
            defaultValue: defaultOptions.arrow,
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

  const probableIdx = Math.abs(Math.round((lastIdx * (time - timestamps[0])) / (timestamps[lastIdx] - timestamps[0])));
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
