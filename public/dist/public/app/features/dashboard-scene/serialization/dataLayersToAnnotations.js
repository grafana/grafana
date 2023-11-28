import { dataLayers } from '@grafana/scenes';
export function dataLayersToAnnotations(layers) {
    const annotations = [];
    for (const layer of layers) {
        if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
            continue;
        }
        const result = Object.assign(Object.assign({}, layer.state.query), { enable: Boolean(layer.state.isEnabled), hide: Boolean(layer.state.isHidden) });
        annotations.push(result);
    }
    return annotations;
}
//# sourceMappingURL=dataLayersToAnnotations.js.map