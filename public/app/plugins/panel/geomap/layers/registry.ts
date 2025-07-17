import OpenLayersMap from 'ol/Map';

import {
  MapLayerRegistryItem,
  Registry,
  MapLayerOptions,
  GrafanaTheme2,
  EventBus,
  SelectableValue,
  PluginState,
} from '@grafana/data';
import { config, hasAlphaPanels } from 'app/core/config';

import { basemapLayers } from './basemaps';
import { carto } from './basemaps/carto';
import { dataLayers } from './data';

export const DEFAULT_BASEMAP_CONFIG: MapLayerOptions = {
  type: 'default',
  name: '', // will get filled in with a non-empty name
  config: {},
};

// Default base layer depending on the server setting
export const defaultBaseLayer: MapLayerRegistryItem = {
  id: DEFAULT_BASEMAP_CONFIG.type,
  name: 'Default base layer',
  isBaseMap: true,

  create: (map: OpenLayersMap, options: MapLayerOptions, eventBus: EventBus, theme: GrafanaTheme2) => {
    const serverLayerType = config?.geomapDefaultBaseLayerConfig?.type;
    if (serverLayerType) {
      const layer = geomapLayerRegistry.getIfExists(serverLayerType);
      if (!layer) {
        throw new Error('Invalid basemap configuration on server');
      }
      return layer.create(map, config.geomapDefaultBaseLayerConfig!, eventBus, theme);
    }

    // For now use carto as our default basemap
    return carto.create(map, options, eventBus, theme);
  },
};

/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry<MapLayerRegistryItem<any>>(() => [
  defaultBaseLayer,
  ...basemapLayers, // simple basemaps
  ...dataLayers, // Layers with update functions
]);

interface RegistrySelectInfo {
  options: Array<SelectableValue<string>>;
  current: Array<SelectableValue<string>>;
}

function getLayersSelection(items: Array<MapLayerRegistryItem<any>>, current?: string): RegistrySelectInfo {
  const registry: RegistrySelectInfo = { options: [], current: [] };
  const alpha: Array<SelectableValue<string>> = [];

  for (const layer of items) {
    const option: SelectableValue<string> = { label: layer.name, value: layer.id, description: layer.description };

    switch (layer.state) {
      case PluginState.alpha:
        if (!hasAlphaPanels) {
          break;
        }
        option.label = `${layer.name} (Alpha)`;
        option.icon = 'bolt';
        alpha.push(option);
        break;
      case PluginState.beta:
        option.label = `${layer.name} (Beta)`;
      default:
        registry.options.push(option);
    }

    if (layer.id === current) {
      registry.current.push(option);
    }
  }

  // Position alpha layers at the end of the layers list
  for (const layer of alpha) {
    registry.options.push(layer);
  }

  return registry;
}

export function getLayersOptions(basemap: boolean, current?: string): RegistrySelectInfo {
  if (basemap) {
    return getLayersSelection([defaultBaseLayer, ...basemapLayers], current);
  }

  return getLayersSelection([...dataLayers, ...basemapLayers], current);
}
