import { createEmpty, extend } from 'ol/extent';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
export function getLayersExtent(layers = [], allLayers = false, lastOnly = false, layer) {
    return layers
        .filter((l) => l.layer instanceof VectorLayer || l.layer instanceof LayerGroup)
        .flatMap((ll) => {
        var _a, _b, _c;
        const l = ll.layer;
        if (l instanceof LayerGroup) {
            return getLayerGroupExtent(l);
        }
        else if (l instanceof VectorLayer) {
            if (allLayers) {
                // Return everything from all layers
                return (_a = [l.getSource().getExtent()]) !== null && _a !== void 0 ? _a : [];
            }
            else if (lastOnly && layer === ll.options.name) {
                // Return last only for selected layer
                const feat = l.getSource().getFeatures();
                const featOfInterest = feat[feat.length - 1];
                const geo = featOfInterest === null || featOfInterest === void 0 ? void 0 : featOfInterest.getGeometry();
                if (geo) {
                    return (_b = [geo.getExtent()]) !== null && _b !== void 0 ? _b : [];
                }
                return [];
            }
            else if (!lastOnly && layer === ll.options.name) {
                // Return all points for selected layer
                return (_c = [l.getSource().getExtent()]) !== null && _c !== void 0 ? _c : [];
            }
            return [];
        }
        else {
            return [];
        }
    })
        .reduce(extend, createEmpty());
}
export function getLayerGroupExtent(lg) {
    return lg
        .getLayers()
        .getArray()
        .filter((l) => l instanceof VectorLayer)
        .map((l) => {
        var _a;
        if (l instanceof VectorLayer) {
            return (_a = l.getSource().getExtent()) !== null && _a !== void 0 ? _a : [];
        }
        else {
            return [];
        }
    });
}
//# sourceMappingURL=getLayersExtent.js.map