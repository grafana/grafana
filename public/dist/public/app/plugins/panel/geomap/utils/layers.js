import { __awaiter } from "tslib";
import { Subject } from 'rxjs';
import { getFrameMatchers, textUtil } from '@grafana/data';
import { config } from '@grafana/runtime/src';
import { MARKERS_LAYER_ID } from '../layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { getNextLayerName } from './utils';
export const applyLayerFilter = (handler, options, panelDataProps) => {
    if (handler.update) {
        let panelData = panelDataProps;
        if (options.filterData) {
            const matcherFunc = getFrameMatchers(options.filterData);
            panelData = Object.assign(Object.assign({}, panelData), { series: panelData.series.filter(matcherFunc) });
        }
        handler.update(panelData);
    }
};
export function updateLayer(panel, uid, newOptions) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        if (!panel.map) {
            return false;
        }
        const current = panel.byName.get(uid);
        if (!current) {
            return false;
        }
        let layerIndex = -1;
        const group = (_a = panel.map) === null || _a === void 0 ? void 0 : _a.getLayers();
        for (let i = 0; i < (group === null || group === void 0 ? void 0 : group.getLength()); i++) {
            if (group.item(i) === current.layer) {
                layerIndex = i;
                break;
            }
        }
        // Special handling for rename
        if (newOptions.name !== uid) {
            if (!newOptions.name) {
                newOptions.name = uid;
            }
            else if (panel.byName.has(newOptions.name)) {
                return false;
            }
            panel.byName.delete(uid);
            uid = newOptions.name;
            panel.byName.set(uid, current);
        }
        // Type changed -- requires full re-initalization
        if (current.options.type !== newOptions.type) {
            // full init
        }
        else {
            // just update options
        }
        const layers = panel.layers.slice(0);
        try {
            const info = yield initLayer(panel, panel.map, newOptions, current.isBasemap);
            (_d = (_b = layers[layerIndex]) === null || _b === void 0 ? void 0 : (_c = _b.handler).dispose) === null || _d === void 0 ? void 0 : _d.call(_c);
            layers[layerIndex] = info;
            group.setAt(layerIndex, info.layer);
            // initialize with new data
            applyLayerFilter(info.handler, newOptions, panel.props.data);
        }
        catch (err) {
            console.warn('ERROR', err); // eslint-disable-line no-console
            return false;
        }
        // Just to trigger a state update
        panel.setState({ legends: [] });
        panel.layers = layers;
        panel.doOptionsUpdate(layerIndex);
        return true;
    });
}
export function initLayer(panel, map, options, isBasemap) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (isBasemap && (!(options === null || options === void 0 ? void 0 : options.type) || config.geomapDisableCustomBaseLayer)) {
            options = DEFAULT_BASEMAP_CONFIG;
        }
        // Use default makers layer
        if (!(options === null || options === void 0 ? void 0 : options.type)) {
            options = {
                type: MARKERS_LAYER_ID,
                name: getNextLayerName(panel),
                config: {},
            };
        }
        const item = geomapLayerRegistry.getIfExists(options.type);
        if (!item) {
            return Promise.reject('unknown layer: ' + options.type);
        }
        if ((_a = options.config) === null || _a === void 0 ? void 0 : _a.attribution) {
            options.config.attribution = textUtil.sanitizeTextPanelContent(options.config.attribution);
        }
        const handler = yield item.create(map, options, panel.props.eventBus, config.theme2);
        const layer = handler.init(); // eslint-disable-line
        if (options.opacity != null) {
            layer.setOpacity(options.opacity);
        }
        if (!options.name) {
            options.name = getNextLayerName(panel);
        }
        const UID = options.name;
        const state = {
            // UID, // unique name when added to the map (it may change and will need special handling)
            isBasemap,
            options,
            layer,
            handler,
            mouseEvents: new Subject(),
            getName: () => UID,
            // Used by the editors
            onChange: (cfg) => {
                updateLayer(panel, UID, cfg);
            },
        };
        panel.byName.set(UID, state);
        // eslint-disable-next-line
        state.layer.__state = state;
        applyLayerFilter(handler, options, panel.props.data);
        return state;
    });
}
export const getMapLayerState = (l) => {
    return l === null || l === void 0 ? void 0 : l.__state;
};
//# sourceMappingURL=layers.js.map