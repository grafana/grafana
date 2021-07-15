import { MapLayerRegistryItem, MapLayerOptions, MapLayerHandler, PanelData, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';

export interface LastPointConfig {
  icon?: string;
}

const defaultOptions: LastPointConfig = {
  icon: 'https://openlayers.org/en/latest/examples/data/icon.png',
};

export const lastPointTracker: MapLayerRegistryItem<LastPointConfig> = {
  id: 'last-point-tracker',
  name: 'Icon at last point',
  description: 'Show an icon at the last point',
  isBaseMap: false,
  showLocation: true,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerOptions<LastPointConfig>, theme: GrafanaTheme2): MapLayerHandler => {
    const point = new Feature({});
    const config = { ...defaultOptions, ...options.config };

    point.setStyle(
      new style.Style({
        image: new style.Icon({
          src: config.icon,
        }),
      })
    );

    const vectorSource = new source.Vector({
      features: [point],
    });

    const vectorLayer = new layer.Vector({
      source: vectorSource,
    });

    const matchers = getLocationMatchers(options.location);
    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];
        if (frame && frame.length) {
          const info = dataFrameToPoints(frame, matchers);
          if(info.warning) {
            console.log( 'WARN', info.warning);
            return; // ???
          }

          if(info.points?.length) {
            const last = info.points[info.points.length-1];
            point.setGeometry(last);
          }
        }
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
