import { __assign, __awaiter, __generator } from "tslib";
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
// https://carto.com/help/building-maps/basemap-list/
export var LayerTheme;
(function (LayerTheme) {
    LayerTheme["Auto"] = "auto";
    LayerTheme["Light"] = "light";
    LayerTheme["Dark"] = "dark";
})(LayerTheme || (LayerTheme = {}));
export var defaultCartoConfig = {
    theme: LayerTheme.Auto,
    showLabels: true,
};
export var carto = {
    id: 'carto',
    name: 'CARTO reference map',
    isBaseMap: true,
    defaultOptions: defaultCartoConfig,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, ({
                    init: function () {
                        var cfg = __assign(__assign({}, defaultCartoConfig), options.config);
                        var style = cfg.theme;
                        if (!style || style === LayerTheme.Auto) {
                            style = theme.isDark ? 'dark' : 'light';
                        }
                        if (cfg.showLabels) {
                            style += '_all';
                        }
                        else {
                            style += '_nolabels';
                        }
                        return new TileLayer({
                            source: new XYZ({
                                attributions: "<a href=\"https://carto.com/attribution/\">\u00A9 CARTO</a>",
                                url: "https://{1-4}.basemaps.cartocdn.com/" + style + "/{z}/{x}/{y}.png",
                            }),
                        });
                    },
                    registerOptionsUI: function (builder) {
                        builder
                            .addRadio({
                            path: 'config.theme',
                            name: 'Theme',
                            settings: {
                                options: [
                                    { value: LayerTheme.Auto, label: 'Auto', description: 'Match grafana theme' },
                                    { value: LayerTheme.Light, label: 'Light' },
                                    { value: LayerTheme.Dark, label: 'Dark' },
                                ],
                            },
                            defaultValue: defaultCartoConfig.theme,
                        })
                            .addBooleanSwitch({
                            path: 'config.showLabels',
                            name: 'Show labels',
                            description: '',
                            defaultValue: defaultCartoConfig.showLabels,
                        });
                    },
                })];
        });
    }); },
};
export var cartoLayers = [carto];
//# sourceMappingURL=carto.js.map