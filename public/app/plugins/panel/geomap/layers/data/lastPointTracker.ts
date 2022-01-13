import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState, FieldType } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import { getLocationMatchers, setGeometryOnFrame } from 'app/features/geo/utils/location';

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
  state: PluginState.alpha,

  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  create: async (map: Map, options: MapLayerOptions<LastPointConfig>, theme: GrafanaTheme2) => {
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

    const matchers = await getLocationMatchers(options.location);
    return {
      init: () => vectorLayer,
      update: (data: PanelData) => {
        const frame = data.series[0];
        if (frame && frame.length) {
          const out = setGeometryOnFrame(frame, matchers);
          const geo = out.fields.find(f => f.type === FieldType.geo);
          if (!geo) {
            return; // ???
          }

          if (out?.length) {
            const last = geo.values.get(out.length - 1);
            point.setGeometry(last);
          }
        }
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
