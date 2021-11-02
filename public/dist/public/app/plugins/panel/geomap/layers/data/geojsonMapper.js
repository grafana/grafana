import { __assign, __awaiter, __generator, __values } from "tslib";
import { PluginState } from '@grafana/data';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { unByKey } from 'ol/Observable';
import { getGeoMapStyle } from '../../utils/getGeoMapStyle';
import { checkFeatureMatchesStyleRule } from '../../utils/checkFeatureMatchesStyleRule';
import { ComparisonOperation } from '../../types';
import { Stroke, Style } from 'ol/style';
import { GeomapStyleRulesEditor } from '../../editor/GeomapStyleRulesEditor';
var defaultOptions = {
    src: 'public/maps/countries.geojson',
    styles: [],
};
export var DEFAULT_STYLE_RULE = {
    fillColor: '#1F60C4',
    strokeWidth: 1,
    rule: {
        property: '',
        operation: ComparisonOperation.EQ,
        value: '',
    },
};
export var geojsonMapper = {
    id: 'geojson-value-mapper',
    name: 'Map values to GeoJSON file',
    description: 'color features based on query results',
    isBaseMap: false,
    state: PluginState.alpha,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var config, source, key, defaultStyle, vectorLayer;
        return __generator(this, function (_a) {
            config = __assign(__assign({}, defaultOptions), options.config);
            source = new VectorSource({
                url: config.src,
                format: new GeoJSON(),
            });
            key = source.on('change', function () {
                if (source.getState() == 'ready') {
                    unByKey(key);
                    // var olFeatures = source.getFeatures(); // olFeatures.length === 1
                    // window.setTimeout(function () {
                    //     var olFeatures = source.getFeatures(); // olFeatures.length > 1
                    //     // Only after using setTimeout can I search the feature list... :(
                    // }, 100)
                    console.log('SOURCE READY!!!', source.getFeatures().length);
                }
            });
            defaultStyle = new Style({
                stroke: new Stroke({
                    color: DEFAULT_STYLE_RULE.fillColor,
                    width: DEFAULT_STYLE_RULE.strokeWidth,
                }),
            });
            vectorLayer = new VectorLayer({
                source: source,
                style: function (feature) {
                    var e_1, _a;
                    var _b;
                    if (feature && ((_b = config === null || config === void 0 ? void 0 : config.styles) === null || _b === void 0 ? void 0 : _b.length)) {
                        try {
                            for (var _c = __values(config.styles), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var style = _d.value;
                                //check if there is no style rule or if the rule matches feature property
                                if (!style.rule || checkFeatureMatchesStyleRule(style.rule, feature)) {
                                    return getGeoMapStyle(style, feature);
                                }
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    return defaultStyle;
                },
            });
            return [2 /*return*/, {
                    init: function () { return vectorLayer; },
                    update: function (data) {
                        console.log('todo... find values matching the ID and update');
                        // // Update each feature
                        // source.getFeatures().forEach((f) => {
                        //   console.log('Find: ', f.getId(), f.getProperties());
                        // });
                    },
                    // Geojson source url
                    registerOptionsUI: function (builder) {
                        var features = source.getFeatures();
                        console.log('FEATURES', source.getState(), features.length, options);
                        builder
                            .addSelect({
                            path: 'config.src',
                            name: 'GeoJSON URL',
                            settings: {
                                options: [
                                    { label: 'public/maps/countries.geojson', value: 'public/maps/countries.geojson' },
                                    { label: 'public/maps/usa-states.geojson', value: 'public/maps/usa-states.geojson' },
                                ],
                                allowCustomValue: true,
                            },
                            defaultValue: defaultOptions.src,
                        })
                            .addCustomEditor({
                            id: 'config.styles',
                            path: 'config.styles',
                            name: 'Style Rules',
                            editor: GeomapStyleRulesEditor,
                            settings: {},
                            defaultValue: [],
                        });
                    },
                }];
        });
    }); },
    defaultOptions: defaultOptions,
};
//# sourceMappingURL=geojsonMapper.js.map