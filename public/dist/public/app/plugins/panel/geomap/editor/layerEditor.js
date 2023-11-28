import { get as lodashGet, isEqual } from 'lodash';
import { FrameGeometrySourceMode, getFrameMatchers } from '@grafana/data';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';
import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry, getLayersOptions } from '../layers/registry';
import { FrameSelectionEditor } from './FrameSelectionEditor';
export function getLayerEditor(opts) {
    return {
        category: opts.category,
        path: '--',
        defaultValue: opts.basemaps ? DEFAULT_BASEMAP_CONFIG : defaultMarkersConfig,
        values: (parent) => ({
            getContext: (parent) => {
                return Object.assign(Object.assign({}, parent), { options: opts.state.options, instanceState: opts.state });
            },
            getValue: (path) => lodashGet(opts.state.options, path),
            onChange: (path, value) => {
                var _a;
                const { state } = opts;
                const { options } = state;
                if (path === 'type' && value) {
                    const layer = geomapLayerRegistry.getIfExists(value);
                    if (layer) {
                        const opts = Object.assign(Object.assign({}, options), { type: layer.id, config: Object.assign({}, layer.defaultOptions) });
                        if (layer.showLocation) {
                            if (!((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode)) {
                                opts.location = { mode: FrameGeometrySourceMode.Auto };
                            }
                            else {
                                delete opts.location;
                            }
                        }
                        state.onChange(opts);
                        return;
                    }
                }
                state.onChange(setOptionImmutably(options, path, value));
            },
        }),
        build: (builder, context) => {
            if (!opts.state) {
                return;
            }
            const { handler, options } = opts.state;
            const layer = geomapLayerRegistry.getIfExists(options === null || options === void 0 ? void 0 : options.type);
            const layerTypes = getLayersOptions(opts.basemaps, (options === null || options === void 0 ? void 0 : options.type // the selected value
            )
                ? options.type
                : DEFAULT_BASEMAP_CONFIG.type);
            builder.addSelect({
                path: 'type',
                name: 'Layer type',
                settings: {
                    options: layerTypes.options,
                },
            });
            // Show data filter if the layer type can do something with the data query results
            if (handler.update) {
                builder.addCustomEditor({
                    id: 'filterData',
                    path: 'filterData',
                    name: 'Data',
                    editor: FrameSelectionEditor,
                    defaultValue: undefined,
                });
            }
            if (!layer) {
                return; // unknown layer type
            }
            // Don't show UI for default configuration
            if (options.type === DEFAULT_BASEMAP_CONFIG.type) {
                return;
            }
            if (layer.showLocation) {
                let data = context.data;
                // If `filterData` exists filter data feeding into location editor
                if (options.filterData) {
                    const matcherFunc = getFrameMatchers(options.filterData);
                    data = data.filter(matcherFunc);
                }
                addLocationFields('Location', 'location.', builder, options.location, data);
            }
            if (handler.registerOptionsUI) {
                handler.registerOptionsUI(builder, context);
            }
            if (!isEqual(opts.category, ['Base layer'])) {
                if (!layer.hideOpacity) {
                    builder.addSliderInput({
                        path: 'opacity',
                        name: 'Opacity',
                        defaultValue: 1,
                        settings: {
                            min: 0,
                            max: 1,
                            step: 0.1,
                        },
                    });
                }
                builder.addBooleanSwitch({
                    path: 'tooltip',
                    name: 'Display tooltip',
                    description: 'Show the tooltip for layer',
                    defaultValue: true,
                });
            }
        },
    };
}
//# sourceMappingURL=layerEditor.js.map