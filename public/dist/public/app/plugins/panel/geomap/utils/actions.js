import { cloneDeep } from 'lodash';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { geomapLayerRegistry } from '../layers/registry';
import { defaultStyleConfig } from '../style/types';
import { initLayer } from './layers';
import { getNextLayerName } from './utils';
export const getActions = (panel) => {
    const actions = {
        selectLayer: (uid) => {
            const selected = panel.layers.findIndex((v) => v.options.name === uid);
            if (panel.panelContext && panel.panelContext.onInstanceStateChange) {
                panel.panelContext.onInstanceStateChange({
                    map: panel.map,
                    layers: panel.layers,
                    selected,
                    actions: panel.actions,
                });
            }
        },
        canRename: (v) => {
            return !panel.byName.has(v);
        },
        deleteLayer: (uid) => {
            var _a;
            const layers = [];
            for (const lyr of panel.layers) {
                if (lyr.options.name === uid) {
                    (_a = panel.map) === null || _a === void 0 ? void 0 : _a.removeLayer(lyr.layer);
                }
                else {
                    layers.push(lyr);
                }
            }
            panel.layers = layers;
            panel.doOptionsUpdate(0);
        },
        addlayer: (type) => {
            const item = geomapLayerRegistry.getIfExists(type);
            if (!item) {
                return; // ignore empty request
            }
            initLayer(panel, panel.map, Object.assign({ type: item.id, name: getNextLayerName(panel), config: cloneDeep(item.defaultOptions), location: item.showLocation ? { mode: FrameGeometrySourceMode.Auto } : undefined, tooltip: true }, (!item.hideOpacity && { opacity: defaultStyleConfig.opacity })), false).then((lyr) => {
                var _a;
                panel.layers = panel.layers.slice(0);
                panel.layers.push(lyr);
                (_a = panel.map) === null || _a === void 0 ? void 0 : _a.addLayer(lyr.layer);
                panel.doOptionsUpdate(panel.layers.length - 1);
            });
        },
        reorder: (startIndex, endIndex) => {
            var _a;
            const result = Array.from(panel.layers);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            panel.layers = result;
            panel.doOptionsUpdate(endIndex);
            // Add the layers in the right order
            const group = (_a = panel.map) === null || _a === void 0 ? void 0 : _a.getLayers();
            group.clear();
            panel.layers.forEach((v) => group.push(v.layer));
        },
    };
    return actions;
};
//# sourceMappingURL=actions.js.map