import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
  EventBus,
  DataHoverEvent,
  DataHoverClearEvent,
} from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import { Group as LayerGroup } from 'ol/layer';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';

import DayNight from 'ol-ext/source/DayNight';
import { fromLonLat } from 'ol/proj';
import { Subscription } from 'rxjs';
import { MultiLineString } from 'ol/geom';
import { Coordinate } from 'ol/coordinate';

export enum ShowTime {
  From = 'from',
  To = 'to',
}

// Configuration options for Circle overlays
export interface DayNightConfig {
  show: ShowTime;
  sun: boolean;
  nightColor: string;
}

const defaultConfig: DayNightConfig = {
  show: ShowTime.To,
  sun: false,
  nightColor: '#a7a6ba4D',
};

export const DAY_NIGHT_LAYER_ID = 'dayNight';

// Used by default when nothing is configured
export const defaultDayNightConfig: MapLayerOptions<DayNightConfig> = {
  type: DAY_NIGHT_LAYER_ID,
  name: '', // will get replaced
  config: defaultConfig,
  tooltip: true,
};

/**
 * Map layer configuration for circle overlay
 */
export const dayNightLayer: MapLayerRegistryItem<DayNightConfig> = {
  id: DAY_NIGHT_LAYER_ID,
  name: 'Night / Day',
  description: 'Show day and night regions',
  isBaseMap: false,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<DayNightConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultConfig,
      ...options?.config,
    };

    // DayNight source
    const source = new DayNight({});
    const sourceMethods = Object.getPrototypeOf(source);
    const sourceLine = new DayNight({});
    const sourceLineMethods = Object.getPrototypeOf(sourceLine);

    // Night polygon
    const vectorLayer = new VectorLayer({
      source,
      style: new Style({
        fill: new Fill({
          color: theme.visualization.getColorByName(config.nightColor),
        }),
      }),
    });

    // Night line (for crosshair sharing)
    const nightLineLayer = new VectorLayer({
      source: new VectorSource({
        features: [],
      }),
      style: new Style({
        stroke: new Stroke({
          color: '#607D8B',
          width: 1.5,
          lineDash: [2, 3],
        }),
      }),
    });

    // Sun circle
    const sunFeature = new Feature({
      geometry: new Point([]),
    });

    const sunLayer = new VectorLayer({
      source: new VectorSource({
        features: [sunFeature],
      }),
      style: new Style({
        image: new Circle({
          radius: 13,
          fill: new Fill({ color: 'rgb(253,184,19)' }),
        }),
      }),
    });

    // Sun line (for crosshair sharing)
    const sunLineFeature = new Feature({
      geometry: new Point([]),
    });

    const sunLineStyle = new Style({
      image: new Circle({
        radius: 13,
        stroke: new Stroke({
          color: 'rgb(253,184,19)',
          width: 1.5,
        }),
      }),
    });

    const sunLineStyleDash = new Style({
      image: new Circle({
        radius: 15,
        stroke: new Stroke({
          color: '#607D8B',
          width: 1.5,
          lineDash: [2, 3],
        }),
      }),
    });

    const sunLineLayer = new VectorLayer({
      source: new VectorSource({
        features: [sunLineFeature],
      }),
      style: [sunLineStyleDash, sunLineStyle],
    });

    // Build group of layers
    // TODO: add blended night region to "connect" current night region to lines
    const layer = new LayerGroup({
      layers: config.sun ? [vectorLayer, sunLayer, sunLineLayer, nightLineLayer] : [vectorLayer, nightLineLayer],
    });

    // Crosshair sharing subscriptions
    const subscriptions = new Subscription();

    if (false) {
      subscriptions.add(
        eventBus.subscribe(DataHoverEvent, (event) => {
          const time = event.payload?.point?.time as number;
          if (time) {
            const lineTime = new Date(time);
            const nightLinePoints = sourceLine.getCoordinates(lineTime.toString(), 'line');
            nightLineLayer.getSource()?.clear();
            const lineStringArray: Coordinate[][] = [];
            for (let l = 0; l < nightLinePoints.length - 1; l++) {
              const x1: number = Object.values(nightLinePoints[l])[0];
              const y1: number = Object.values(nightLinePoints[l])[1];
              const x2: number = Object.values(nightLinePoints[l + 1])[0];
              const y2: number = Object.values(nightLinePoints[l + 1])[1];
              const lineString = [fromLonLat([x1, y1]), fromLonLat([x2, y2])];
              lineStringArray.push(lineString);
            }
            nightLineLayer.getSource()?.addFeature(
              new Feature({
                geometry: new MultiLineString(lineStringArray),
              })
            );

            let sunLinePos: number[] = [];
            sunLinePos = sourceLineMethods.getSunPosition(lineTime);
            sunLineFeature.getGeometry()?.setCoordinates(fromLonLat(sunLinePos));
            sunLineFeature.setStyle([sunLineStyle, sunLineStyleDash]);
          }
        })
      );

      subscriptions.add(
        eventBus.subscribe(DataHoverClearEvent, (event) => {
          nightLineLayer.getSource()?.clear();
          sunLineFeature.setStyle(new Style({}));
        })
      );
    }

    return {
      init: () => layer,
      dispose: () => subscriptions.unsubscribe(),
      update: (data: PanelData) => {
        const from = new Date(data.timeRange.from.valueOf());
        const to = new Date(data.timeRange.to.valueOf());
        let selectedTime: Date = new Date();
        let sunPos: number[] = [];
        // TODO: add option for "Both"
        if (config.show === ShowTime.From) {
          selectedTime = from;
        } else {
          selectedTime = to;
        }

        source.setTime(selectedTime);
        if (config.sun) {
          sunPos = sourceMethods.getSunPosition(selectedTime);
          sunFeature.getGeometry()?.setCoordinates(fromLonLat(sunPos));
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        if (!options.config?.nightColor) {
          options.config = { ...defaultConfig, ...options.config };
        }

        builder.addRadio({
          path: 'config.show',
          name: 'Show',
          settings: {
            options: [
              { label: 'From', value: ShowTime.From },
              { label: 'To', value: ShowTime.To },
            ],
          },
          defaultValue: defaultConfig.show,
        });
        builder.addColorPicker({
          path: 'config.nightColor',
          name: 'Night region color',
          description: 'Pick color of night region',
          defaultValue: defaultConfig.nightColor,
          settings: [{ enableNamedColors: false }],
        });
        builder.addBooleanSwitch({
          path: 'config.sun',
          name: 'Display sun',
          description: 'Show the sun',
          defaultValue: defaultConfig.sun,
        });
      },
    };
  },

  // fill in the default values
  defaultOptions: defaultConfig,
};
