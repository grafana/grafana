import { __awaiter } from "tslib";
import { isNumber } from 'lodash';
import Feature from 'ol/Feature';
import { LineString, Point, SimpleGeometry } from 'ol/geom';
import { Group as LayerGroup } from 'ol/layer';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Circle } from 'ol/style';
import FlowLine from 'ol-ext/style/FlowLine';
import { Subscription, throttleTime } from 'rxjs';
import tinycolor from 'tinycolor2';
import { PluginState, DataHoverEvent, DataHoverClearEvent, TIME_SERIES_TIME_FIELD_NAME, } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getGeometryField, getLocationMatchers } from 'app/features/geo/utils/location';
import { StyleEditor } from '../../editor/StyleEditor';
import { routeStyle } from '../../style/markers';
import { defaultStyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension, isSegmentVisible } from '../../utils/utils';
const defaultOptions = {
    style: Object.assign(Object.assign({}, defaultStyleConfig), { opacity: 1, lineWidth: 2 }),
    arrow: 0,
};
export const ROUTE_LAYER_ID = 'route';
// Used by default when nothing is configured
export const defaultRouteConfig = {
    type: ROUTE_LAYER_ID,
    name: '',
    config: defaultOptions,
    location: {
        mode: FrameGeometrySourceMode.Auto,
    },
    tooltip: false,
};
/**
 * Map layer configuration for circle overlay
 */
export const routeLayer = {
    id: ROUTE_LAYER_ID,
    name: 'Route',
    description: 'Render data points as a route',
    isBaseMap: false,
    showLocation: true,
    state: PluginState.beta,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        // Assert default values
        const config = Object.assign(Object.assign({}, defaultOptions), options === null || options === void 0 ? void 0 : options.config);
        const style = yield getStyleConfigState(config.style);
        const location = yield getLocationMatchers(options.location);
        const source = new FrameVectorSource(location);
        const vectorLayer = new VectorLayer({ source });
        const hasArrows = config.arrow === 1 || config.arrow === -1;
        if (!style.fields && !hasArrows) {
            // Set a global style
            const styleBase = routeStyle(style.base);
            if (style.config.size && style.config.size.fixed) {
                // Applies width to base style if specified
                styleBase.getStroke().setWidth(style.config.size.fixed);
            }
            vectorLayer.setStyle(styleBase);
        }
        else {
            vectorLayer.setStyle((feature) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                const idx = feature.get('rowIndex');
                const dims = style.dims;
                if (!dims || !isNumber(idx)) {
                    return routeStyle(style.base);
                }
                const styles = [];
                const geom = feature.getGeometry();
                const opacity = (_a = style.config.opacity) !== null && _a !== void 0 ? _a : 1;
                if (geom instanceof SimpleGeometry) {
                    const coordinates = geom.getCoordinates();
                    if (coordinates) {
                        let startIndex = 0; // Index start for segment optimization
                        const pixelTolerance = 2; // For segment to be visible, it must be > 2 pixels (due to round ends)
                        for (let i = 0; i < coordinates.length - 1; i++) {
                            const segmentStartCoords = coordinates[startIndex];
                            const segmentEndCoords = coordinates[i + 1];
                            const color1 = tinycolor(theme.visualization.getColorByName((_b = (dims.color && dims.color.get(startIndex))) !== null && _b !== void 0 ? _b : style.base.color))
                                .setAlpha(opacity)
                                .toString();
                            const color2 = tinycolor(theme.visualization.getColorByName((_c = (dims.color && dims.color.get(i + 1))) !== null && _c !== void 0 ? _c : style.base.color))
                                .setAlpha(opacity)
                                .toString();
                            const arrowSize1 = (_d = (dims.size && dims.size.get(startIndex))) !== null && _d !== void 0 ? _d : style.base.size;
                            const arrowSize2 = (_e = (dims.size && dims.size.get(i + 1))) !== null && _e !== void 0 ? _e : style.base.size;
                            const flowStyle = new FlowLine({
                                visible: true,
                                lineCap: config.arrow === 0 ? 'round' : 'square',
                                color: color1,
                                color2: color2,
                                width: (_f = (dims.size && dims.size.get(startIndex))) !== null && _f !== void 0 ? _f : style.base.size,
                                width2: (_g = (dims.size && dims.size.get(i + 1))) !== null && _g !== void 0 ? _g : style.base.size,
                            });
                            if (config.arrow) {
                                flowStyle.setArrow(config.arrow);
                                if (config.arrow > 0) {
                                    flowStyle.setArrowColor(color2);
                                    flowStyle.setArrowSize((arrowSize2 !== null && arrowSize2 !== void 0 ? arrowSize2 : 0) * 1.5);
                                }
                                else {
                                    flowStyle.setArrowColor(color1);
                                    flowStyle.setArrowSize((arrowSize1 !== null && arrowSize1 !== void 0 ? arrowSize1 : 0) * 1.5);
                                }
                            }
                            // Only render segment if change in pixel coordinates is significant enough
                            if (isSegmentVisible(map, pixelTolerance, segmentStartCoords, segmentEndCoords)) {
                                const LS = new LineString([segmentStartCoords, segmentEndCoords]);
                                flowStyle.setGeometry(LS);
                                styles.push(flowStyle);
                                startIndex = i + 1; // Because a segment was created, move onto the next one
                            }
                        }
                        // If no segments created, render a single point
                        if (styles.length === 0) {
                            const P = new Point(coordinates[0]);
                            const radius = ((_j = (_h = (dims.size && dims.size.get(0))) !== null && _h !== void 0 ? _h : style.base.size) !== null && _j !== void 0 ? _j : 10) / 2;
                            const color = tinycolor(theme.visualization.getColorByName((_k = (dims.color && dims.color.get(0))) !== null && _k !== void 0 ? _k : style.base.color))
                                .setAlpha(opacity)
                                .toString();
                            const ZoomOutCircle = new Style({
                                image: new Circle({
                                    radius: radius,
                                    fill: new Fill({
                                        color: color,
                                    }),
                                }),
                            });
                            ZoomOutCircle.setGeometry(P);
                            styles.push(ZoomOutCircle);
                        }
                    }
                    return styles;
                }
                const values = Object.assign({}, style.base);
                if (dims.color) {
                    values.color = dims.color.get(idx);
                }
                return routeStyle(values);
            });
        }
        // Crosshair layer
        const crosshairFeature = new Feature({});
        const crosshairRadius = (style.base.lineWidth || 6) + 2;
        const crosshairStyle = new Style({
            image: new Circle({
                radius: crosshairRadius,
                stroke: new Stroke({
                    color: alpha(style.base.color, 0.4),
                    width: crosshairRadius + 2,
                }),
                fill: new Fill({ color: style.base.color }),
            }),
        });
        const crosshairLayer = new VectorLayer({
            source: new VectorSource({
                features: [crosshairFeature],
            }),
            style: crosshairStyle,
        });
        const layer = new LayerGroup({
            layers: [vectorLayer, crosshairLayer],
        });
        // Crosshair sharing subscriptions
        const subscriptions = new Subscription();
        subscriptions.add(eventBus
            .getStream(DataHoverEvent)
            .pipe(throttleTime(8))
            .subscribe({
            next: (event) => {
                var _a, _b;
                const feature = source.getFeatures()[0];
                const frame = feature === null || feature === void 0 ? void 0 : feature.get('frame');
                const time = (_b = (_a = event.payload) === null || _a === void 0 ? void 0 : _a.point) === null || _b === void 0 ? void 0 : _b.time;
                if (frame && time) {
                    const timeField = frame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
                    if (timeField) {
                        const timestamps = timeField.values;
                        const pointIdx = findNearestTimeIndex(timestamps, time);
                        if (pointIdx !== null) {
                            const out = getGeometryField(frame, location);
                            if (out.field) {
                                crosshairFeature.setGeometry(out.field.values[pointIdx]);
                                crosshairFeature.setStyle(crosshairStyle);
                            }
                        }
                    }
                }
            },
        }));
        subscriptions.add(eventBus.subscribe(DataHoverClearEvent, (event) => {
            crosshairFeature.setStyle(new Style({}));
        }));
        return {
            init: () => layer,
            dispose: () => subscriptions.unsubscribe(),
            update: (data) => {
                var _a;
                if (!((_a = data.series) === null || _a === void 0 ? void 0 : _a.length)) {
                    return; // ignore empty
                }
                for (const frame of data.series) {
                    if (style.fields || hasArrows) {
                        style.dims = getStyleDimension(frame, style, theme);
                    }
                    source.updateLineString(frame);
                    break; // Only the first frame for now!
                }
            },
            // Route layer options
            registerOptionsUI: (builder) => {
                builder
                    .addCustomEditor({
                    id: 'config.style',
                    path: 'config.style',
                    name: 'Style',
                    editor: StyleEditor,
                    settings: {
                        simpleFixedValues: false,
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
                        ],
                    },
                    defaultValue: defaultOptions.arrow,
                });
            },
        };
    }),
    // fill in the default values
    defaultOptions,
};
function findNearestTimeIndex(timestamps, time) {
    if (timestamps.length === 0) {
        return null;
    }
    else if (timestamps.length === 1) {
        return 0;
    }
    const lastIdx = timestamps.length - 1;
    if (time < timestamps[0]) {
        return 0;
    }
    else if (time > timestamps[lastIdx]) {
        return lastIdx;
    }
    const probableIdx = Math.abs(Math.round((lastIdx * (time - timestamps[0])) / (timestamps[lastIdx] - timestamps[0])));
    if (time < timestamps[probableIdx]) {
        for (let i = probableIdx; i > 0; i--) {
            if (time > timestamps[i]) {
                return i < lastIdx ? i + 1 : lastIdx;
            }
        }
        return 0;
    }
    else {
        for (let i = probableIdx; i < lastIdx; i++) {
            if (time < timestamps[i]) {
                return i > 0 ? i - 1 : 0;
            }
        }
        return lastIdx;
    }
}
//# sourceMappingURL=routeLayer.js.map