import { MapLayerOptions, MapLayerRegistryItem, PluginState } from '@grafana/data';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { hasAlphaPanels } from 'app/core/config';
import { MapLayerState } from '../types';
import { get as lodashGet } from 'lodash';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';

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
      onChange: (path: string, value: any) => {
        const { state } = opts;
        const { options } = state;
        if (path === 'type' && value) {
          const layer = geomapLayerRegistry.getIfExists(value);
          if (layer) {
            console.log('Change layer type:', value, state);
            state.onChange({
              ...options, // keep current shared options
              type: layer.id,
              config: { ...layer.defaultOptions }, // clone?
            });
            return;
          }
        }
        state.onChange(setOptionImmutably(options, path, value));
      },
    }),
    build: (builder, context) => {
      if (!opts.state) {
        console.log('MISSING LAYER!!!', opts);
        return;
      }

      const { handler, options } = opts.state;
      const layer = geomapLayerRegistry.getIfExists(options?.type);

      const layerTypes = geomapLayerRegistry.selectOptions(
        options?.type // the selected value
          ? [options.type] // as an array
          : [DEFAULT_BASEMAP_CONFIG.type],
        opts.basemaps ? baseMapFilter : dataLayerFilter
      );

      builder.addSelect({
        path: 'type',
        name: 'Layer type', // required, but hide space
        settings: {
          options: layerTypes.options,
        },
      });

      if (!layer) {
        return; // unknown layer type
      }

      // Don't show UI for default configuration
      if (options.type === DEFAULT_BASEMAP_CONFIG.type) {
        return;
      }

      if (layer.showLocation) {
        addLocationFields('location', builder, options.location);
      }
      if (handler.registerOptionsUI) {
        handler.registerOptionsUI(builder);
      }
      if (layer.showOpacity) {
        // TODO -- add opacity check
      }

      builder.addBooleanSwitch({
        path: 'tooltip',
        name: 'Display tooltip',
        description: 'Show the tooltip for layer',
        defaultValue: true,
      });
    },
  };
}

function baseMapFilter(layer: MapLayerRegistryItem): boolean {
  if (!layer.isBaseMap) {
    return false;
  }
  if (layer.state === PluginState.alpha) {
    return hasAlphaPanels;
  }
  return true;
}

export function dataLayerFilter(layer: MapLayerRegistryItem): boolean {
  if (layer.isBaseMap) {
    return false;
  }
  if (layer.state === PluginState.alpha) {
    return hasAlphaPanels;
  }
  return true;
}
