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
import { LineString, SimpleGeometry } from 'ol/geom';
import FlowLine from 'ol-ext/style/FlowLine';

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
        // TODO better understand how we want to apply color logic functions
        const idx = feature.get('rowIndex') as number;
        const dims = style.dims;
        if (!dims || !isNumber(idx)) {
          return routeStyle(style.base);
        }

        const styles = [];
        const geom = feature.getGeometry();

        let opacityString: string;
        const opacityInt = Math.floor((style.config.opacity ?? 1) * 255);
        opacityString = componentToHex(opacityInt);

        if (geom instanceof SimpleGeometry && dims.color) {
          const coordinates = geom.getCoordinates();
          if (coordinates) {
            for (let i = 0; i < coordinates.length - 1; i++) {
              const color1 = dims.color.get(i);
              const color2 = dims.color.get(i + 1);
              const color1Hex = colorToHex(colorValues(color1));
              const color2Hex = colorToHex(colorValues(color2));

              const flowStyle = new FlowLine({
                visible: true,
                lineCap: 'round',
                color: color1Hex + opacityString,
                color2: color2Hex + opacityString,
                width: style.config.lineWidth,
              });
              const LS = new LineString([coordinates[i], coordinates[i + 1]]);
              flowStyle.setGeometry(LS);
              styles.push(flowStyle);
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
              simpleFixedValues: false,
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

// Return array of [r,g,b,a] from any valid color. If failed, returns transparent
function colorValues(color: string) {
  if (color === '') return [0, 0, 0, 0];
  if (color.toLowerCase() === 'transparent') return [0, 0, 0, 0];
  // Hex color
  if (color[0] === '#') {
    if (color.length < 7) {
      // convert #RGB and #RGBA to #RRGGBB and #RRGGBBAA
      color =
        '#' +
        color[1] +
        color[1] +
        color[2] +
        color[2] +
        color[3] +
        color[3] +
        (color.length > 4 ? color[4] + color[4] : '');
    }
    return [
      parseInt(color.substr(1, 2), 16),
      parseInt(color.substr(3, 2), 16),
      parseInt(color.substr(5, 2), 16),
      color.length > 7 ? parseInt(color.substr(7, 2), 16) / 255 : 1,
    ];
  }
  // Named colors
  // TODO find a way to interpret named colors without creating an element
  if (color.indexOf('rgb') === -1) {
    const temp_elem = document.body.appendChild(document.createElement('fictum')); // intentionally use unknown tag to lower chances of css rule override with !important
    const flag = 'rgb(1, 2, 3)';
    temp_elem.style.color = flag;
    if (temp_elem.style.color !== flag) return [0, 0, 0, 0];
    temp_elem.style.color = color;
    if (temp_elem.style.color === flag || temp_elem.style.color === '') return [0, 0, 0, 0];
    color = getComputedStyle(temp_elem).color;
    document.body.removeChild(temp_elem);
  }
  // RGB colors
  if (color.indexOf('rgb') === 0) {
    if (color.indexOf('rgba') === -1) color += ',1'; // convert 'rgb(R,G,B)' to 'rgb(R,G,B)A'
    return color.match(/[\.\d]+/g)!.map(function (a) {
      return +a;
    });
  }
  return [0, 0, 0, 0];
}

function componentToHex(c: number) {
  const hex = c.toString(16);
  return hex.length == 1 ? '0' + hex : hex;
}

function colorToHex(c: number[] | undefined) {
  let hex: string = '';
  if (c && c.length > 2) {
    hex = '#' + componentToHex(c[0]) + componentToHex(c[1]) + componentToHex(c[2]);
    hex = hex.toLocaleUpperCase();
  }
  return hex;
}
