import { Registry, PluginState, } from '@grafana/data';
import { config, hasAlphaPanels } from 'app/core/config';
import { basemapLayers } from './basemaps';
import { carto } from './basemaps/carto';
import { dataLayers } from './data';
export const DEFAULT_BASEMAP_CONFIG = {
    type: 'default',
    name: '',
    config: {},
};
// Default base layer depending on the server setting
export const defaultBaseLayer = {
    id: DEFAULT_BASEMAP_CONFIG.type,
    name: 'Default base layer',
    isBaseMap: true,
    create: (map, options, eventBus, theme) => {
        var _a;
        const serverLayerType = (_a = config === null || config === void 0 ? void 0 : config.geomapDefaultBaseLayerConfig) === null || _a === void 0 ? void 0 : _a.type;
        if (serverLayerType) {
            const layer = geomapLayerRegistry.getIfExists(serverLayerType);
            if (!layer) {
                throw new Error('Invalid basemap configuration on server');
            }
            return layer.create(map, config.geomapDefaultBaseLayerConfig, eventBus, theme);
        }
        // For now use carto as our default basemap
        return carto.create(map, options, eventBus, theme);
    },
};
/**
 * Registry for layer handlers
 */
export const geomapLayerRegistry = new Registry(() => [
    defaultBaseLayer,
    ...basemapLayers,
    ...dataLayers, // Layers with update functions
]);
function getLayersSelection(items, current) {
    const registry = { options: [], current: [] };
    const alpha = [];
    for (const layer of items) {
        const option = { label: layer.name, value: layer.id, description: layer.description };
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
export function getLayersOptions(basemap, current) {
    if (basemap) {
        return getLayersSelection([defaultBaseLayer, ...basemapLayers], current);
    }
    return getLayersSelection([...dataLayers, ...basemapLayers], current);
}
//# sourceMappingURL=registry.js.map