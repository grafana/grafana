import { debounce } from 'lodash';
import { toLonLat } from 'ol/proj';
import { DataHoverClearEvent } from '@grafana/data/src';
import { getMapLayerState } from './layers';
export const setTooltipListeners = (panel) => {
    var _a, _b, _c;
    // Tooltip listener
    (_a = panel.map) === null || _a === void 0 ? void 0 : _a.on('singleclick', panel.pointerClickListener);
    (_b = panel.map) === null || _b === void 0 ? void 0 : _b.on('pointermove', debounce(panel.pointerMoveListener, 200));
    (_c = panel.map) === null || _c === void 0 ? void 0 : _c.getViewport().addEventListener('mouseout', (evt) => {
        panel.props.eventBus.publish(new DataHoverClearEvent());
    });
};
export const pointerClickListener = (evt, panel) => {
    if (pointerMoveListener(evt, panel)) {
        evt.preventDefault();
        evt.stopPropagation();
        panel.mapDiv.style.cursor = 'auto';
        panel.setState({ ttipOpen: true });
    }
};
export const pointerMoveListener = (evt, panel) => {
    var _a, _b, _c, _d;
    // If measure menu is open, bypass tooltip logic and display measuring mouse events
    if (panel.state.measureMenuActive) {
        return true;
    }
    // Eject out of this function if map is not loaded or valid tooltip is already open
    if (!panel.map || (panel.state.ttipOpen && ((_c = (_b = (_a = panel.state) === null || _a === void 0 ? void 0 : _a.ttip) === null || _b === void 0 ? void 0 : _b.layers) === null || _c === void 0 ? void 0 : _c.length))) {
        return false;
    }
    const mouse = evt.originalEvent;
    const pixel = panel.map.getEventPixel(mouse);
    const hover = toLonLat(panel.map.getCoordinateFromPixel(pixel));
    const { hoverPayload } = panel;
    hoverPayload.pageX = mouse.pageX;
    hoverPayload.pageY = mouse.pageY;
    hoverPayload.point = {
        lat: hover[1],
        lon: hover[0],
    };
    hoverPayload.data = undefined;
    hoverPayload.columnIndex = undefined;
    hoverPayload.rowIndex = undefined;
    hoverPayload.layers = undefined;
    const layers = [];
    const layerLookup = new Map();
    let ttip = {};
    panel.map.forEachFeatureAtPixel(pixel, (feature, layer, geo) => {
        const s = getMapLayerState(layer);
        //match hover layer to layer in layers
        //check if the layer show tooltip is enabled
        //then also pass the list of tooltip fields if exists
        //this is used as the generic hover event
        if (!hoverPayload.data) {
            const props = feature.getProperties();
            const frame = props['frame'];
            if (frame) {
                hoverPayload.data = ttip.data = frame;
                hoverPayload.rowIndex = ttip.rowIndex = props['rowIndex'];
            }
            if (s === null || s === void 0 ? void 0 : s.mouseEvents) {
                s.mouseEvents.next(feature);
            }
        }
        if (s) {
            let h = layerLookup.get(s);
            if (!h) {
                h = { layer: s, features: [] };
                layerLookup.set(s, h);
                layers.push(h);
            }
            h.features.push(feature);
        }
    }, {
        layerFilter: (l) => {
            var _a;
            const hoverLayerState = getMapLayerState(l);
            return ((_a = hoverLayerState === null || hoverLayerState === void 0 ? void 0 : hoverLayerState.options) === null || _a === void 0 ? void 0 : _a.tooltip) !== false;
        },
    });
    panel.hoverPayload.layers = layers.length ? layers : undefined;
    panel.props.eventBus.publish(panel.hoverEvent);
    // This check optimizes Geomap panel re-render behavior (without it, Geomap renders on every mouse move event)
    if (panel.state.ttip === undefined || ((_d = panel.state.ttip) === null || _d === void 0 ? void 0 : _d.layers) !== hoverPayload.layers || hoverPayload.layers) {
        panel.setState({ ttip: Object.assign({}, hoverPayload) });
    }
    if (!layers.length) {
        // clear mouse events
        panel.layers.forEach((layer) => {
            layer.mouseEvents.next(undefined);
        });
    }
    const found = Boolean(layers.length);
    panel.mapDiv.style.cursor = found ? 'pointer' : 'auto';
    return found;
};
//# sourceMappingURL=tooltip.js.map