import { isNumber } from 'lodash';
import Feature, { FeatureLike } from 'ol/Feature';
import OpenLayersMap from 'ol/Map';
import { LineString, Point, SimpleGeometry } from 'ol/geom';
import { Group as LayerGroup } from 'ol/layer';
import VectorImage from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import FlowLine from 'ol-ext/style/FlowLine';
import { Subscription, throttleTime } from 'rxjs';
import tinycolor from 'tinycolor2';

import {
  MapLayerRegistryItem,
  PanelData,
  GrafanaTheme2,
  PluginState,
  EventBus,
  DataHoverEvent,
  DataHoverClearEvent,
  DataFrame,
  FieldType,
  colorManipulator,
  MapLayerOptions,
} from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';

import { StyleEditor } from '../../editor/StyleEditor';
import { routeStyle } from '../../style/markers';
import { defaultStyleConfig, StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
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

enum mapIndex {
  x1 = 0,
  y1 = 1,
  x2 = 2,
  y2 = 3,
}

const crosshairColor = '#607D8B';

/**
 * Map layer configuration for circle overlay
 */
export const routeLayer: MapLayerRegistryItem<RouteConfig> = {
  id: ROUTE_LAYER_ID,
  name: 'Route',
  description: 'Render data points as a route',
  isBaseMap: false,
  showLocation: true,
  state: PluginState.beta,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<RouteConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultOptions,
      ...options?.config,
    };

    const style = await getStyleConfigState(config.style);
    const location = await getLocationMatchers(options.location);
    const source = new FrameVectorSource(location);
    const vectorLayer = new VectorImage({ source });
    const hasArrows = config.arrow === 1 || config.arrow === -1;

    if (!style.fields && !hasArrows) {
      // Set a global style
      const styleBase = routeStyle(style.base);
      if (style.config.size && style.config.size.fixed) {
        // Applies width to base style if specified
        styleBase.getStroke()?.setWidth(style.config.size.fixed);
      }
      vectorLayer.setStyle(styleBase);
    } else {
      vectorLayer.setStyle((feature: FeatureLike) => {
        const idx: number = feature.get('rowIndex');
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
                lineCap: config.arrow === 0 ? 'round' : 'square',
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
    const hLineFeature = new Feature({});
    const vLineFeature = new Feature({});
    const lineFeatures = [hLineFeature, vLineFeature];
    const crosshairRadius = (style.base.lineWidth || 6) + 3;
    const crosshairStyle = new Style({
      image: new Circle({
        radius: crosshairRadius,
        stroke: new Stroke({
          color: colorManipulator.alpha(crosshairColor, 1),
          width: 1,
        }),
        fill: new Fill({ color: colorManipulator.alpha(crosshairColor, 0.4) }),
      }),
    });
    const lineStyle = new Style({
      stroke: new Stroke({
        color: crosshairColor,
        width: 1,
        lineDash: [3, 3],
        lineCap: 'square',
      }),
    });

    const crosshairLayer = new VectorImage({
      source: new VectorSource({
        features: [crosshairFeature],
      }),
      style: crosshairStyle,
    });

    const linesLayer = new VectorImage({
      source: new VectorSource({
        features: lineFeatures,
      }),
      style: lineStyle,
    });

    const layer = new LayerGroup({
      layers: [vectorLayer, crosshairLayer, linesLayer],
    });

    // Crosshair sharing subscriptions
    const subscriptions = new Subscription();

    subscriptions.add(
      eventBus
        .getStream(DataHoverEvent)
        .pipe(throttleTime(8))
        .subscribe({
          next: (event) => {
            const mapExtents = map.getView().calculateExtent(map.getSize());
            const feature = source.getFeatures()[0];
            const frame: DataFrame = feature?.get('frame');
            const time = event.payload?.point?.time;
            if (frame && time) {
              const timeField = frame.fields.find((f) => f.type === FieldType.time);
              if (timeField) {
                const timestamps: number[] = timeField.values;
                const pointIdx = findNearestTimeIndex(timestamps, time);
                if (pointIdx !== null) {
                  const out = getGeometryField(frame, location);
                  if (out.field) {
                    const crosshairPoint: Point = out.field.values[pointIdx] as Point;
                    const crosshairPointCoords = crosshairPoint.getCoordinates();
                    crosshairFeature.setGeometry(crosshairPoint);
                    crosshairFeature.setStyle(crosshairStyle);
                    hLineFeature.setGeometry(
                      new LineString([
                        [mapExtents[mapIndex.x1], crosshairPointCoords[mapIndex.y1]],
                        [mapExtents[mapIndex.x2], crosshairPointCoords[mapIndex.y1]],
                      ])
                    );
                    vLineFeature.setGeometry(
                      new LineString([
                        [crosshairPointCoords[mapIndex.x1], mapExtents[mapIndex.y1]],
                        [crosshairPointCoords[mapIndex.x1], mapExtents[mapIndex.y2]],
                      ])
                    );
                    lineFeatures.forEach((feature) => feature.setStyle(lineStyle));
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
        lineFeatures.forEach((feature) => feature.setStyle(new Style({})));
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

          source.clear(true);
          const info = getGeometryField(frame, location);
          if (!info.field) {
            source.changed();
            break;
          }
          const coords: number[][] = [];
          for (const v of info.field.values) {
            if (v instanceof Point) {
              coords.push(v.getCoordinates());
            }
          }
          if (coords.length >= 2) {
            const geometry = new LineString(coords);
            source['addFeatureInternal'](
              new Feature({
                frame,
                rowIndex: 0,
                geometry,
              })
            );
          }
          source.changed();

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
        return i < lastIdx ? i + 1 : lastIdx;
      }
    }
    return 0;
  } else {
    for (let i = probableIdx; i < lastIdx; i++) {
      if (time < timestamps[i]) {
        return i > 0 ? i - 1 : 0;
      }
    }
    return lastIdx;
  }
}
