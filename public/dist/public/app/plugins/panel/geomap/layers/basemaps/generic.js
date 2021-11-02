import { __assign, __awaiter, __generator } from "tslib";
import XYZ from 'ol/source/XYZ';
import TileLayer from 'ol/layer/Tile';
var sampleURL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer';
export var defaultXYZConfig = {
    url: sampleURL + '/tile/{z}/{y}/{x}',
    attribution: "Tiles \u00A9 <a href=\"" + sampleURL + "\">ArcGIS</a>",
};
export var xyzTiles = {
    id: 'xyz',
    name: 'XYZ Tile layer',
    isBaseMap: true,
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, ({
                    init: function () {
                        var _a;
                        var cfg = __assign({}, options.config);
                        if (!cfg.url) {
                            cfg.url = defaultXYZConfig.url;
                            cfg.attribution = (_a = cfg.attribution) !== null && _a !== void 0 ? _a : defaultXYZConfig.attribution;
                        }
                        return new TileLayer({
                            source: new XYZ({
                                url: cfg.url,
                                attributions: cfg.attribution, // singular?
                            }),
                            minZoom: cfg.minZoom,
                            maxZoom: cfg.maxZoom,
                        });
                    },
                    registerOptionsUI: function (builder) {
                        builder
                            .addTextInput({
                            path: 'config.url',
                            name: 'URL template',
                            description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
                            settings: {
                                placeholder: defaultXYZConfig.url,
                            },
                        })
                            .addTextInput({
                            path: 'config.attribution',
                            name: 'Attribution',
                            settings: {
                                placeholder: defaultXYZConfig.attribution,
                            },
                        });
                    },
                })];
        });
    }); },
};
export var genericLayers = [xyzTiles];
//# sourceMappingURL=generic.js.map