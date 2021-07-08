import { MapLayerRegistryItem, MapLayerConfig, MapLayerHandler, PanelData, Field, GrafanaTheme2 } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';

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

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: (map: Map, options: MapLayerConfig<LastPointConfig>, theme: GrafanaTheme2): MapLayerHandler => {
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

    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];
        if (frame && frame.length) {
          let lat: Field | undefined = undefined;
          let lng: Field | undefined = undefined;
          for (const field of frame.fields) {
            if (field.name === 'lat') {
              lat = field;
            } else if (field.name === 'lng') {
              lng = field;
            }
          }

          if (lat && lng) {
            const idx = lat.values.length - 1;
            const latV = lat.values.get(idx);
            const lngV = lng.values.get(idx);
            if (latV != null && lngV != null) {
              point.setGeometry(new Point(fromLonLat([lngV, latV])));
            }
          }
        }
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
