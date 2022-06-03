import {
  MapLayerRegistryItem,
  MapLayerOptions,
  PanelData,
  GrafanaTheme2,
} from '@grafana/data';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import { Circle, Fill, Style } from 'ol/style';

import {DayNight} from 'ol-ext/source/DayNight';

export enum ShowTime {
  From = 'from',
  To = 'to',
}

// Configuration options for Circle overlays
export interface DayNightConfig {
  show: ShowTime;
}

const defaultConfig: DayNightConfig = {
  show: ShowTime.To,
};

export const DAY_NIGHT_LAYER_ID = 'markers';

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
  description: 'Show daylight regions',
  isBaseMap: false,

  /**
   * Function that configures transformation and returns a transformer
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: Map, options: MapLayerOptions<DayNightConfig>, theme: GrafanaTheme2) => {
    // Assert default values
    const config = {
      ...defaultConfig,
      ...options?.config,
    };

    console.log( "INIT (DayNight)", config );

    // DayNight source
    const source = new DayNight({ });

    const vectorLayer = new VectorLayer({
      source,
      style: new Style({
        image: new Circle({
          radius: 5,
          fill: new Fill({ color: 'red' })
        }),
        fill: new Fill({
          color: [0,0,50,.5]
        })
      })
    });

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        if (!data.series?.length) {
          source.clear();
          return; // ignore empty
        }
      },

      // Marker overlay options
      registerOptionsUI: (builder) => {
        builder
          .addRadio({
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
      },
    };
  },

  // fill in the default values
  defaultOptions: defaultConfig,
};
