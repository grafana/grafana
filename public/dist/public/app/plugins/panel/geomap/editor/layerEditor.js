import { __assign } from "tslib";
import { FrameGeometrySourceMode, FieldType, PluginState, } from '@grafana/data';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { GazetteerPathEditor } from './GazetteerPathEditor';
import { defaultMarkersConfig } from '../layers/data/markersLayer';
import { hasAlphaPanels } from 'app/core/config';
import { get as lodashGet } from 'lodash';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
export function getLayerEditor(opts) {
    return {
        category: opts.category,
        path: '--',
        defaultValue: opts.basemaps ? DEFAULT_BASEMAP_CONFIG : defaultMarkersConfig,
        values: function (parent) { return ({
            getContext: function (parent) {
                return __assign(__assign({}, parent), { options: opts.state.options, instanceState: opts.state });
            },
            getValue: function (path) { return lodashGet(opts.state.options, path); },
            onChange: function (path, value) {
                var state = opts.state;
                var options = state.options;
                if (path === 'type' && value) {
                    var layer = geomapLayerRegistry.getIfExists(value);
                    if (layer) {
                        console.log('Change layer type:', value, state);
                        state.onChange(__assign(__assign({}, options), { type: layer.id, config: __assign({}, layer.defaultOptions) }));
                        return;
                    }
                }
                state.onChange(setOptionImmutably(options, path, value));
            },
        }); },
        build: function (builder, context) {
            if (!opts.state) {
                console.log('MISSING LAYER!!!', opts);
                return;
            }
            var _a = opts.state, handler = _a.handler, options = _a.options;
            var layer = geomapLayerRegistry.getIfExists(options === null || options === void 0 ? void 0 : options.type);
            var layerTypes = geomapLayerRegistry.selectOptions((options === null || options === void 0 ? void 0 : options.type // the selected value
            )
                ? [options.type] // as an array
                : [DEFAULT_BASEMAP_CONFIG.type], opts.basemaps ? baseMapFilter : dataLayerFilter);
            builder.addSelect({
                path: 'type',
                name: 'Layer type',
                settings: {
                    options: layerTypes.options,
                },
            });
            if (!layer) {
                return; // unknown layer type
            }
            // Don't show UI for default configuration
            if (options.type === DEFAULT_BASEMAP_CONFIG.type) {
                return;
            }
            if (layer.showLocation) {
                builder
                    .addRadio({
                    path: 'location.mode',
                    name: 'Location',
                    description: '',
                    defaultValue: FrameGeometrySourceMode.Auto,
                    settings: {
                        options: [
                            { value: FrameGeometrySourceMode.Auto, label: 'Auto' },
                            { value: FrameGeometrySourceMode.Coords, label: 'Coords' },
                            { value: FrameGeometrySourceMode.Geohash, label: 'Geohash' },
                            { value: FrameGeometrySourceMode.Lookup, label: 'Lookup' },
                        ],
                    },
                })
                    .addFieldNamePicker({
                    path: 'location.latitude',
                    name: 'Latitude field',
                    settings: {
                        filter: function (f) { return f.type === FieldType.number; },
                        noFieldsMessage: 'No numeric fields found',
                    },
                    showIf: function (opts) { var _a; return ((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode) === FrameGeometrySourceMode.Coords; },
                })
                    .addFieldNamePicker({
                    path: 'location.longitude',
                    name: 'Longitude field',
                    settings: {
                        filter: function (f) { return f.type === FieldType.number; },
                        noFieldsMessage: 'No numeric fields found',
                    },
                    showIf: function (opts) { var _a; return ((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode) === FrameGeometrySourceMode.Coords; },
                })
                    .addFieldNamePicker({
                    path: 'location.geohash',
                    name: 'Geohash field',
                    settings: {
                        filter: function (f) { return f.type === FieldType.string; },
                        noFieldsMessage: 'No strings fields found',
                    },
                    showIf: function (opts) { var _a; return ((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode) === FrameGeometrySourceMode.Geohash; },
                    // eslint-disable-next-line react/display-name
                    // info: (props) => <div>HELLO</div>,
                })
                    .addFieldNamePicker({
                    path: 'location.lookup',
                    name: 'Lookup field',
                    settings: {
                        filter: function (f) { return f.type === FieldType.string; },
                        noFieldsMessage: 'No strings fields found',
                    },
                    showIf: function (opts) { var _a; return ((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode) === FrameGeometrySourceMode.Lookup; },
                })
                    .addCustomEditor({
                    id: 'gazetteer',
                    path: 'location.gazetteer',
                    name: 'Gazetteer',
                    editor: GazetteerPathEditor,
                    showIf: function (opts) { var _a; return ((_a = opts.location) === null || _a === void 0 ? void 0 : _a.mode) === FrameGeometrySourceMode.Lookup; },
                });
            }
            if (handler.registerOptionsUI) {
                handler.registerOptionsUI(builder);
            }
            if (layer.showOpacity) {
                // TODO -- add opacity check
            }
        },
    };
}
function baseMapFilter(layer) {
    if (!layer.isBaseMap) {
        return false;
    }
    if (layer.state === PluginState.alpha) {
        return hasAlphaPanels;
    }
    return true;
}
export function dataLayerFilter(layer) {
    if (layer.isBaseMap) {
        return false;
    }
    if (layer.state === PluginState.alpha) {
        return hasAlphaPanels;
    }
    return true;
}
//# sourceMappingURL=layerEditor.js.map