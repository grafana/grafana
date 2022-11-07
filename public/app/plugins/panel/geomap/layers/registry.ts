import { Map as OpenLayersMap } from 'ol';

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
  const res: RegistrySelectInfo = { options: [], current: [] };
  const alpha: Array<SelectableValue<string>> = [];
  for (const layer of items) {
    const opt: SelectableValue<string> = { label: layer.name, value: layer.id, description: layer.description };
    if (layer.state === PluginState.alpha) {
      if (!hasAlphaPanels) {
        continue;
      }
      opt.label = `${layer.name} (Alpha)`;
      opt.icon = 'bolt';
      alpha.push(opt);
    } else {
      res.options.push(opt);
    }
    if (layer.id === current) {
      res.current.push(opt);
    }
  }
  for (const p of alpha) {
    res.options.push(p);
  }
  return res;
}

export function getLayersOptions(basemap: boolean, current?: string): RegistrySelectInfo {
  if (basemap) {
    return getLayersSelection([defaultBaseLayer, ...basemapLayers], current);
  }
  return getLayersSelection([...dataLayers, ...basemapLayers], current);
}
