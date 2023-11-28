import { __awaiter } from "tslib";
import { isNumber } from 'lodash';
import VectorLayer from 'ol/layer/Vector';
import React from 'react';
import { ReplaySubject } from 'rxjs';
import { FrameGeometrySourceMode, } from '@grafana/data';
import { FrameVectorSource } from 'app/features/geo/utils/frameVectorSource';
import { getLocationMatchers } from 'app/features/geo/utils/location';
import { MarkersLegend } from '../../components/MarkersLegend';
import { ObservablePropsWrapper } from '../../components/ObservablePropsWrapper';
import { StyleEditor } from '../../editor/StyleEditor';
import { defaultStyleConfig } from '../../style/types';
import { getStyleConfigState } from '../../style/utils';
import { getStyleDimension } from '../../utils/utils';
const defaultOptions = {
    style: defaultStyleConfig,
    showLegend: true,
};
export const MARKERS_LAYER_ID = 'markers';
// Used by default when nothing is configured
export const defaultMarkersConfig = {
    type: MARKERS_LAYER_ID,
    name: '',
    config: defaultOptions,
    location: {
        mode: FrameGeometrySourceMode.Auto,
    },
    tooltip: true,
};
/**
 * Map layer configuration for circle overlay
 */
export const markersLayer = {
    id: MARKERS_LAYER_ID,
    name: 'Markers',
    description: 'Use markers to render each data point',
    isBaseMap: false,
    showLocation: true,
    hideOpacity: true,
    /**
     * Function that configures transformation and returns a transformer
     * @param map
     * @param options
     * @param theme
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        // Assert default values
        const config = Object.assign(Object.assign({}, defaultOptions), options === null || options === void 0 ? void 0 : options.config);
        const style = yield getStyleConfigState(config.style);
        const location = yield getLocationMatchers(options.location);
        const source = new FrameVectorSource(location);
        const vectorLayer = new VectorLayer({
            source,
        });
        const legendProps = new ReplaySubject(1);
        let legend = null;
        if (config.showLegend) {
            legend = React.createElement(ObservablePropsWrapper, { watch: legendProps, initialSubProps: {}, child: MarkersLegend });
        }
        if (!style.fields) {
            // Set a global style
            vectorLayer.setStyle(style.maker(style.base));
        }
        else {
            vectorLayer.setStyle((feature) => {
                const idx = feature.get('rowIndex');
                const dims = style.dims;
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
        }
        return {
            init: () => vectorLayer,
            legend: legend,
            update: (data) => {
                var _a, _b;
                if (!((_a = data.series) === null || _a === void 0 ? void 0 : _a.length)) {
                    source.clear();
                    return; // ignore empty
                }
                for (const frame of data.series) {
                    style.dims = getStyleDimension(frame, style, theme);
                    // Post updates to the legend component
                    if (legend) {
                        legendProps.next({
                            styleConfig: style,
                            size: (_b = style.dims) === null || _b === void 0 ? void 0 : _b.size,
                            layerName: options.name,
                            layer: vectorLayer,
                        });
                    }
                    source.update(frame);
                    break; // Only the first frame for now!
                }
            },
            // Marker overlay options
            registerOptionsUI: (builder) => {
                builder
                    .addCustomEditor({
                    id: 'config.style',
                    path: 'config.style',
                    name: 'Styles',
                    editor: StyleEditor,
                    settings: {
                        displayRotation: true,
                    },
                    defaultValue: defaultOptions.style,
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
//# sourceMappingURL=markersLayer.js.map