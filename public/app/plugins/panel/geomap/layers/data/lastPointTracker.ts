import { MapLayerRegistryItem, MapLayerOptions, PanelData, GrafanaTheme2, PluginState, EventBus } from '@grafana/data';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';

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
  create: async (map: Map, options: MapLayerOptions<LastPointConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
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
          const out = getGeometryField(frame, matchers);
          if (!out.field) {
            return; // ???
          }
          point.setGeometry(out.field.values.get(frame.length - 1));
        }
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
