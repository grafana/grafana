import { get as lodashGet, isEqual } from 'lodash';

import { FrameGeometrySourceMode, getFrameMatchers, MapLayerOptions } from '@grafana/data';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';

import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry, getLayersOptions } from '../layers/registry';
import { MapLayerState } from '../types';

import { FrameSelectionEditor } from './FrameSelectionEditor';

export interface LayerEditorOptions {
  state: MapLayerState;
  category: string[];
  basemaps: boolean; // only basemaps
}

export function getLayerEditor(opts: LayerEditorOptions): NestedPanelOptions<MapLayerOptions> {
  return {
    category: opts.category,
    path: '--', // Not used
    defaultValue: opts.basemaps ? DEFAULT_BASEMAP_CONFIG : defaultMarkersConfig,
    values: (parent: NestedValueAccess) => ({
      getContext: (parent) => {
        return { ...parent, options: opts.state.options, instanceState: opts.state };
      },
      getValue: (path: string) => lodashGet(opts.state.options, path),
      onChange: (path: string, value: string) => {
        const { state } = opts;
        const { options } = state;
        if (path === 'type' && value) {
          const layer = geomapLayerRegistry.getIfExists(value);
          if (layer) {
            const opts = {
              ...options, // keep current shared options
              type: layer.id,
              config: { ...layer.defaultOptions }, // clone?
            };
            if (layer.showLocation) {
              if (!opts.location?.mode) {
                opts.location = { mode: FrameGeometrySourceMode.Auto };
              } else {
                delete opts.location;
              }
            }
            state.onChange(opts);
            return;
          }
        }
        state.onChange(setOptionImmutably(options, path, value));
      },
    }),
    build: (builder, context) => {
      if (!opts.state) {
        return;
      }

      const { handler, options } = opts.state;
      const layer = geomapLayerRegistry.getIfExists(options?.type);

      const layerTypes = getLayersOptions(
        opts.basemaps,
        options?.type // the selected value
          ? options.type
          : DEFAULT_BASEMAP_CONFIG.type
      );

      builder.addSelect({
        path: 'type',
        name: 'Layer type', // required, but hide space
        settings: {
          options: layerTypes.options,
        },
      });

      // Show data filter if the layer type can do something with the data query results
      if (handler.update) {
        builder.addCustomEditor({
          id: 'filterData',
          path: 'filterData',
          name: 'Data',
          editor: FrameSelectionEditor,
          defaultValue: undefined,
        });
      }

      if (!layer) {
        return; // unknown layer type
      }

      // Don't show UI for default configuration
      if (options.type === DEFAULT_BASEMAP_CONFIG.type) {
        return;
      }

      if (layer.showLocation) {
        let data = context.data;
        // If `filterData` exists filter data feeding into location editor
        if (options.filterData) {
          const matcherFunc = getFrameMatchers(options.filterData);
          data = data.filter(matcherFunc);
        }

        addLocationFields('Location', 'location.', builder, options.location, data);
      }
      if (handler.registerOptionsUI) {
        handler.registerOptionsUI(builder);
      }
      if (!isEqual(opts.category, ['Base layer'])) {
        if (!layer.hideOpacity) {
          builder.addSliderInput({
            path: 'opacity',
            name: 'Opacity',
            defaultValue: 1,
            settings: {
              min: 0,
              max: 1,
              step: 0.1,
            },
          });
        }
        builder.addBooleanSwitch({
          path: 'tooltip',
          name: 'Display tooltip',
          description: 'Show the tooltip for layer',
          defaultValue: true,
        });
      }
    },
  };
}
