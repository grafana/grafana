import { __awaiter } from "tslib";
import { isNumber } from 'lodash';
import { Feature } from 'ol';
import { LineString, SimpleGeometry } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import FlowLine from 'ol-ext/style/FlowLine';
import React from 'react';
import { ReplaySubject } from 'rxjs';
import tinycolor from 'tinycolor2';
import { FrameGeometrySourceMode, PluginState, } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { getGraphFrame } from 'app/plugins/panel/nodeGraph/utils';
import { MarkersLegend } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { defaultStyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';
const defaultOptions = {
    style: defaultStyleConfig,
    showLegend: false,
    edgeStyle: defaultStyleConfig,
    arrow: 0,
};
export const NETWORK_LAYER_ID = 'network';
// Used by default when nothing is configured
export const defaultMarkersConfig = {
    type: NETWORK_LAYER_ID,
    name: '',
    config: defaultOptions,
    location: {
        mode: FrameGeometrySourceMode.Auto,
    },
};
/**
 * Map layer configuration for network overlay
 */
export const networkLayer = {
    id: NETWORK_LAYER_ID,
    name: 'Network',
    description: 'Render a node graph as a map layer',
    isBaseMap: false,
    showLocation: true,
    hideOpacity: true,
    state: PluginState.beta,
    /**
     * Function that configures transformation and returns a transformer
     * @param map
     * @param options
     * @param eventBus
     * @param theme
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        // Assert default values
        const config = Object.assign(Object.assign({}, defaultOptions), options === null || options === void 0 ? void 0 : options.config);
        const style = yield getStyleConfigState(config.style);
        const edgeStyle = yield getStyleConfigState(config.edgeStyle);
        const location = yield getLocationMatchers(options.location);
        const source = new FrameVectorSource(location);
        const vectorLayer = new VectorLayer({
            source,
        });
        const hasArrows = config.arrow === 1 || config.arrow === -1 || config.arrow === 2;
        // TODO update legend to display edges as well
        const legendProps = new ReplaySubject(1);
        let legend = null;
        if (config.showLegend) {
            legend = React.createElement(ObservablePropsWrapper, { watch: legendProps, initialSubProps: {}, child: MarkersLegend });
        }
        vectorLayer.setStyle((feature) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const geom = feature.getGeometry();
            const idx = feature.get('rowIndex');
            const dims = style.dims;
            if (!style.fields && !edgeStyle.fields && !hasArrows && (geom === null || geom === void 0 ? void 0 : geom.getType()) !== 'LineString') {
                // Set a global style
                return style.maker(style.base);
            }
            // For edges
            if ((geom === null || geom === void 0 ? void 0 : geom.getType()) === 'LineString' && geom instanceof SimpleGeometry) {
                const edgeDims = edgeStyle.dims;
                const edgeTextConfig = edgeStyle.config.textConfig;
                const edgeId = Number(feature.getId());
                const coordinates = geom.getCoordinates();
                const opacity = (_a = edgeStyle.config.opacity) !== null && _a !== void 0 ? _a : 1;
                if (coordinates && edgeDims) {
                    const segmentStartCoords = coordinates[0];
                    const segmentEndCoords = coordinates[1];
                    const color1 = tinycolor(theme.visualization.getColorByName((_b = (edgeDims.color && edgeDims.color.get(edgeId))) !== null && _b !== void 0 ? _b : edgeStyle.base.color))
                        .setAlpha(opacity)
                        .toString();
                    const color2 = tinycolor(theme.visualization.getColorByName((_c = (edgeDims.color && edgeDims.color.get(edgeId))) !== null && _c !== void 0 ? _c : edgeStyle.base.color))
                        .setAlpha(opacity)
                        .toString();
                    const arrowSize1 = (_d = (edgeDims.size && edgeDims.size.get(edgeId))) !== null && _d !== void 0 ? _d : edgeStyle.base.size;
                    const arrowSize2 = (_e = (edgeDims.size && edgeDims.size.get(edgeId))) !== null && _e !== void 0 ? _e : edgeStyle.base.size;
                    const styles = [];
                    const flowStyle = new FlowLine({
                        visible: true,
                        lineCap: config.arrow === 0 ? 'round' : 'square',
                        color: color1,
                        color2: color2,
                        width: (_f = (edgeDims.size && edgeDims.size.get(edgeId))) !== null && _f !== void 0 ? _f : edgeStyle.base.size,
                        width2: (_g = (edgeDims.size && edgeDims.size.get(edgeId))) !== null && _g !== void 0 ? _g : edgeStyle.base.size,
                    });
                    if (config.arrow) {
                        flowStyle.setArrow(config.arrow);
                        if (config.arrow > 0) {
                            flowStyle.setArrowColor(color2);
                            flowStyle.setArrowSize((arrowSize2 !== null && arrowSize2 !== void 0 ? arrowSize2 : 0) * 2);
                        }
                        else {
                            flowStyle.setArrowColor(color1);
                            flowStyle.setArrowSize((arrowSize1 !== null && arrowSize1 !== void 0 ? arrowSize1 : 0) * 2);
                        }
                    }
                    const LS = new LineString([segmentStartCoords, segmentEndCoords]);
                    flowStyle.setGeometry(LS);
                    const fontFamily = theme.typography.fontFamily;
                    if (edgeDims.text || ((_h = edgeStyle.config.text) === null || _h === void 0 ? void 0 : _h.mode) === TextDimensionMode.Fixed) {
                        const labelStyle = new Style({
                            zIndex: 10,
                            text: new Text(Object.assign({ text: (_k = (_j = edgeDims.text) === null || _j === void 0 ? void 0 : _j.get(edgeId)) !== null && _k !== void 0 ? _k : (_l = edgeStyle.config.text) === null || _l === void 0 ? void 0 : _l.fixed, font: `normal ${edgeTextConfig === null || edgeTextConfig === void 0 ? void 0 : edgeTextConfig.fontSize}px ${fontFamily}`, fill: new Fill({ color: color1 !== null && color1 !== void 0 ? color1 : defaultStyleConfig.color.fixed }), stroke: new Stroke({
                                    color: tinycolor(theme.visualization.getColorByName('text')).setAlpha(opacity).toString(),
                                    width: Math.max((edgeTextConfig === null || edgeTextConfig === void 0 ? void 0 : edgeTextConfig.fontSize) / 10, 1),
                                }) }, edgeTextConfig)),
                        });
                        labelStyle.setGeometry(LS);
                        styles.push(labelStyle);
                    }
                    styles.push(flowStyle);
                    return styles;
                }
            }
            if (!dims || !isNumber(idx)) {
                return style.maker(style.base);
            }
            const values = Object.assign({}, style.base);
            if (dims.color) {
                values.color = dims.color.get(idx);
            }
            if (dims.size) {
                values.size = dims.size.get(idx);
            }
            if (dims.text) {
                values.text = dims.text.get(idx);
            }
            if (dims.rotation) {
                values.rotation = dims.rotation.get(idx);
            }
            return style.maker(values);
        });
        return {
            init: () => vectorLayer,
            legend: legend,
            update: (data) => {
                var _a, _b;
                if (!((_a = data.series) === null || _a === void 0 ? void 0 : _a.length)) {
                    source.clear();
                    return; // ignore empty
                }
                // Post updates to the legend component
                if (legend) {
                    legendProps.next({
                        styleConfig: style,
                        size: (_b = style.dims) === null || _b === void 0 ? void 0 : _b.size,
                        layerName: options.name,
                        layer: vectorLayer,
                    });
                }
                const graphFrames = getGraphFrame(data.series);
                for (const frame of data.series) {
                    if (frame === graphFrames.edges[0]) {
                        edgeStyle.dims = getStyleDimension(frame, edgeStyle, theme);
                    }
                    else {
                        style.dims = getStyleDimension(frame, style, theme);
                    }
                    updateEdge(source, graphFrames);
                }
            },
            // Marker overlay options
            registerOptionsUI: (builder, context) => {
                const networkFrames = getGraphFrame(context.data);
                const frameNodes = networkFrames.nodes[0];
                const frameEdges = networkFrames.edges[0];
                builder
                    .addCustomEditor({
                    id: 'config.style',
                    category: ['Node Styles'],
                    path: 'config.style',
                    name: 'Node Styles',
                    editor: StyleEditor,
                    settings: {
                        displayRotation: true,
                        frameMatcher: (frame) => frame === frameNodes,
                    },
                    defaultValue: defaultOptions.style,
                })
                    .addCustomEditor({
                    id: 'config.edgeStyle',
                    category: ['Edge Styles'],
                    path: 'config.edgeStyle',
                    name: 'Edge Styles',
                    editor: StyleEditor,
                    settings: {
                        hideSymbol: true,
                        frameMatcher: (frame) => frame === frameEdges,
                    },
                    defaultValue: defaultOptions.style,
                })
                    .addRadio({
                    path: 'config.arrow',
                    name: 'Arrow',
                    settings: {
                        options: [
                            { label: 'None', value: 0 },
                            { label: 'Forward', value: 1 },
                            { label: 'Reverse', value: -1 },
                            { label: 'Both', value: 2 },
                        ],
                    },
                    defaultValue: defaultOptions.arrow,
                })
                    .addBooleanSwitch({
                    path: 'config.showLegend',
                    name: 'Show legend',
                    description: 'Show map legend',
                    defaultValue: defaultOptions.showLegend,
                });
            },
        };
    }),
    // fill in the default values
    defaultOptions,
};
function updateEdge(source, graphFrames) {
    source.clear(true);
    const frameNodes = graphFrames.nodes[0];
    const frameEdges = graphFrames.edges[0];
    if (!frameNodes || !frameEdges) {
        // TODO: provide helpful error message / link to docs for how to format data
        return;
    }
    const info = getGeometryField(frameNodes, source.location);
    if (!info.field) {
        source.changed();
        return;
    }
    // TODO: Fix this
    // eslint-disable-next-line
    const field = info.field;
    // TODO for nodes, don't hard code id field name
    const nodeIdIndex = frameNodes.fields.findIndex((f) => f.name === 'id');
    const nodeIdValues = frameNodes.fields[nodeIdIndex].values;
    // Edges
    // TODO for edges, don't hard code source and target fields
    const sourceIndex = frameEdges.fields.findIndex((f) => f.name === 'source');
    const targetIndex = frameEdges.fields.findIndex((f) => f.name === 'target');
    const sources = frameEdges.fields[sourceIndex].values;
    const targets = frameEdges.fields[targetIndex].values;
    // Loop through edges, referencing node locations
    for (let i = 0; i < sources.length; i++) {
        // Create linestring for each edge
        const sourceId = sources[i];
        const targetId = targets[i];
        const sourceNodeIndex = nodeIdValues.findIndex((value) => value === sourceId);
        const targetNodeIndex = nodeIdValues.findIndex((value) => value === targetId);
        if (!field.values[sourceNodeIndex] || !field.values[targetNodeIndex]) {
            continue;
        }
        const geometryEdge = new LineString([
            field.values[sourceNodeIndex].getCoordinates(),
            field.values[targetNodeIndex].getCoordinates(),
        ]);
        const edgeFeature = new Feature({
            geometry: geometryEdge,
        });
        edgeFeature.setId(i);
        source['addFeatureInternal'](edgeFeature); // @TODO revisit?
    }
    // Nodes
    for (let i = 0; i < frameNodes.length; i++) {
        source['addFeatureInternal'](new Feature({
            frameNodes,
            rowIndex: i,
            geometry: info.field.values[i],
        }));
    }
    // only call source at the end
    source.changed();
}
//# sourceMappingURL=networkLayer.js.map