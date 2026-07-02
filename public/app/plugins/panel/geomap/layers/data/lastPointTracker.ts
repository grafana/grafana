import Feature from 'ol/Feature';
import type OpenLayersMap from 'ol/Map';
import * as layer from 'ol/layer';
import * as source from 'ol/source';
import * as style from 'ol/style';

import { type MapLayerRegistryItem, type MapLayerOptions, type PanelData, type GrafanaTheme2, type EventBus, PluginState } from '@grafana/data';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';

import { StyleEditor } from '../../editor/StyleEditor';
import { defaultStyleConfig, type StyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';

export interface LastPointConfig {
  style: StyleConfig;
  icon?: string;
}

const defaultOptions: LastPointConfig = {
  style: {
    ...defaultStyleConfig,
    opacity: 1,
  },
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
   * @param map
   * @param options
   * @param theme
   */
  create: async (map: OpenLayersMap, options: MapLayerOptions<LastPointConfig>, eventBus: EventBus, theme: GrafanaTheme2) => {
    const point = new Feature({});
    const config = { ...defaultOptions, ...options.config };
    const styleState = await getStyleConfigState(config.style);
    const useLegacyIcon = Boolean(options.config?.icon && !options.config?.style);

    if (useLegacyIcon) {
      point.setStyle(
        new style.Style({
          image: new style.Icon({
            src: config.icon,
          }),
        })
      );
    } else {
      point.setStyle(styleState.maker(styleState.base));
    }

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

          if (!useLegacyIcon) {
            const dims = getStyleDimension(frame, styleState, theme);
            const rowIndex = frame.length - 1;
            const values = { ...styleState.base };

            if (dims.color) {
              values.color = dims.color.get(rowIndex);
            }
            if (dims.size) {
              values.size = dims.size.get(rowIndex);
            }
            if (dims.text) {
              values.text = dims.text.get(rowIndex);
            }
            if (dims.rotation) {
              values.rotation = dims.rotation.get(rowIndex);
            }

            point.setStyle(styleState.maker(values));
          }

          point.setGeometry(out.field.values[frame.length - 1]);
        }
      },

      registerOptionsUI: (builder) => {
        builder.addCustomEditor({
          id: 'config.style',
          path: 'config.style',
          name: 'Style',
          editor: StyleEditor,
          settings: {
            displayRotation: true,
          },
          defaultValue: defaultOptions.style,
        });
      },
    };
  },

  // fill in the default values
  defaultOptions,
};
