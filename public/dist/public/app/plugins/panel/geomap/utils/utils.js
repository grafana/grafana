import { __awaiter } from "tslib";
import { Map as OpenLayersMap } from 'ol';
import { defaults as interactionDefaults } from 'ol/interaction';
import { getColorDimension, getScalarDimension, getScaledDimension, getTextDimension } from 'app/features/dimensions';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { defaultStyleConfig } from '../style/types';
export function getStyleDimension(frame, style, theme, customStyleConfig) {
    var _a, _b, _c, _d, _e, _f;
    const dims = {};
    if (customStyleConfig && Object.keys(customStyleConfig).length) {
        dims.color = getColorDimension(frame, (_a = customStyleConfig.color) !== null && _a !== void 0 ? _a : defaultStyleConfig.color, theme);
        dims.size = getScaledDimension(frame, (_b = customStyleConfig.size) !== null && _b !== void 0 ? _b : defaultStyleConfig.size);
        dims.rotation = getScalarDimension(frame, (_c = customStyleConfig.rotation) !== null && _c !== void 0 ? _c : defaultStyleConfig.rotation);
        if (customStyleConfig.text && (customStyleConfig.text.field || customStyleConfig.text.fixed)) {
            dims.text = getTextDimension(frame, customStyleConfig.text);
        }
    }
    else {
        if (style.fields) {
            if (style.fields.color) {
                dims.color = getColorDimension(frame, (_d = style.config.color) !== null && _d !== void 0 ? _d : defaultStyleConfig.color, theme);
            }
            if (style.fields.size) {
                dims.size = getScaledDimension(frame, (_e = style.config.size) !== null && _e !== void 0 ? _e : defaultStyleConfig.size);
            }
            if (style.fields.text) {
                dims.text = getTextDimension(frame, style.config.text);
            }
            if (style.fields.rotation) {
                dims.rotation = getScalarDimension(frame, (_f = style.config.rotation) !== null && _f !== void 0 ? _f : defaultStyleConfig.rotation);
            }
        }
    }
    return dims;
}
let publicGeoJSONFiles = undefined;
export function getPublicGeoJSONFiles() {
    if (!publicGeoJSONFiles) {
        publicGeoJSONFiles = [];
        initGeojsonFiles(); // async
    }
    return publicGeoJSONFiles;
}
// This will find all geojson files in the maps and gazetteer folders
function initGeojsonFiles() {
    return __awaiter(this, void 0, void 0, function* () {
        const ds = yield getGrafanaDatasource();
        for (let folder of ['maps', 'gazetteer']) {
            ds.listFiles(folder).subscribe({
                next: (frame) => {
                    frame.forEach((item) => {
                        if (item.name.endsWith('.geojson')) {
                            const value = `public/${folder}/${item.name}`;
                            publicGeoJSONFiles.push({
                                value,
                                label: value,
                            });
                        }
                    });
                },
            });
        }
    });
}
export const getNewOpenLayersMap = (panel, options, div) => {
    const [view] = panel.initMapView(options.view, undefined);
    return (panel.map = new OpenLayersMap({
        view: view,
        pixelRatio: 1,
        layers: [],
        controls: [],
        target: div,
        interactions: interactionDefaults({
            mouseWheelZoom: false, // managed by initControls
        }),
    }));
};
export const updateMap = (panel, options) => {
    panel.initControls(options.controls);
    panel.forceUpdate(); // first render
};
export const notifyPanelEditor = (geomapPanel, layers, selected) => {
    // Notify the panel editor
    if (geomapPanel.panelContext && geomapPanel.panelContext.onInstanceStateChange) {
        geomapPanel.panelContext.onInstanceStateChange({
            map: geomapPanel.map,
            layers: layers,
            selected: selected,
            actions: geomapPanel.actions,
        });
    }
};
export const getNextLayerName = (panel) => {
    let idx = panel.layers.length; // since basemap is 0, this looks right
    while (true && idx < 100) {
        const name = `Layer ${idx++}`;
        if (!panel.byName.has(name)) {
            return name;
        }
    }
    return `Layer ${Date.now()}`;
};
export function isSegmentVisible(map, pixelTolerance, segmentStartCoords, segmentEndCoords) {
    // For a segment, calculate x and y pixel lengths
    //TODO: let's try to find a less intensive check
    const pixelStart = map.getPixelFromCoordinate(segmentStartCoords);
    const pixelEnd = map.getPixelFromCoordinate(segmentEndCoords);
    const deltaX = Math.abs(pixelStart[0] - pixelEnd[0]);
    const deltaY = Math.abs(pixelStart[1] - pixelEnd[1]);
    // If greater than pixel tolerance in either direction, segment is visible
    if (deltaX > pixelTolerance || deltaY > pixelTolerance) {
        return true;
    }
    return false;
}
export const isUrl = (url) => {
    try {
        const newUrl = new URL(url);
        return newUrl.protocol.includes('http');
    }
    catch (_) {
        return false;
    }
};
//# sourceMappingURL=utils.js.map