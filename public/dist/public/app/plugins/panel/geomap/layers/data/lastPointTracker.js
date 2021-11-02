import { __assign, __awaiter, __generator } from "tslib";
import { PluginState } from '@grafana/data';
import Feature from 'ol/Feature';
import * as style from 'ol/style';
import * as source from 'ol/source';
import * as layer from 'ol/layer';
import { dataFrameToPoints, getLocationMatchers } from '../../utils/location';
var defaultOptions = {
    icon: 'https://openlayers.org/en/latest/examples/data/icon.png',
};
export var lastPointTracker = {
    id: 'last-point-tracker',
    name: 'Icon at last point',
    description: 'Show an icon at the last point',
    isBaseMap: false,
    showLocation: true,
    state: PluginState.alpha,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var point, config, vectorSource, vectorLayer, matchers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    point = new Feature({});
                    config = __assign(__assign({}, defaultOptions), options.config);
                    point.setStyle(new style.Style({
                        image: new style.Icon({
                            src: config.icon,
                        }),
                    }));
                    vectorSource = new source.Vector({
                        features: [point],
                    });
                    vectorLayer = new layer.Vector({
                        source: vectorSource,
                    });
                    return [4 /*yield*/, getLocationMatchers(options.location)];
                case 1:
                    matchers = _a.sent();
                    return [2 /*return*/, {
                            init: function () { return vectorLayer; },
                            update: function (data) {
                                var _a;
                                var frame = data.series[0];
                                if (frame && frame.length) {
                                    var info = dataFrameToPoints(frame, matchers);
                                    if (info.warning) {
                                        console.log('WARN', info.warning);
                                        return; // ???
                                    }
                                    if ((_a = info.points) === null || _a === void 0 ? void 0 : _a.length) {
                                        var last = info.points[info.points.length - 1];
                                        point.setGeometry(last);
                                    }
                                }
                            },
                        }];
            }
        });
    }); },
    // fill in the default values
    defaultOptions: defaultOptions,
};
//# sourceMappingURL=lastPointTracker.js.map