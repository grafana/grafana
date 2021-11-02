import { __assign, __awaiter, __generator } from "tslib";
import { Registry } from '@grafana/data';
import { xyzTiles, defaultXYZConfig } from './generic';
var CUSTOM_SERVICE = 'custom';
var DEFAULT_SERVICE = 'streets';
export var publicServiceRegistry = new Registry(function () { return [
    {
        id: DEFAULT_SERVICE,
        name: 'World Street Map',
        slug: 'World_Street_Map',
    },
    {
        id: 'world-imagery',
        name: 'World Imagery',
        slug: 'World_Imagery',
    },
    {
        id: 'world-physical',
        name: 'World Physical',
        slug: 'World_Physical_Map',
    },
    {
        id: 'topo',
        name: 'Topographic',
        slug: 'World_Topo_Map',
    },
    {
        id: 'usa-topo',
        name: 'USA Topographic',
        slug: 'USA_Topo_Maps',
    },
    {
        id: 'ocean',
        name: 'World Ocean',
        slug: 'Ocean/World_Ocean_Base',
    },
    {
        id: CUSTOM_SERVICE,
        name: 'Custom MapServer',
        description: 'Use a custom MapServer with pre-cached values',
        slug: '',
    },
]; });
export var esriXYZTiles = {
    id: 'esri-xyz',
    name: 'ArcGIS MapServer',
    isBaseMap: true,
    create: function (map, options, theme) { return __awaiter(void 0, void 0, void 0, function () {
        var cfg, svc, base, opts;
        var _a;
        return __generator(this, function (_b) {
            cfg = __assign({}, options.config);
            svc = publicServiceRegistry.getIfExists((_a = cfg.server) !== null && _a !== void 0 ? _a : DEFAULT_SERVICE);
            if (svc.id !== CUSTOM_SERVICE) {
                base = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
                cfg.url = "" + base + svc.slug + "/MapServer/tile/{z}/{y}/{x}";
                cfg.attribution = "Tiles \u00A9 <a href=\"" + base + svc.slug + "/MapServer\">ArcGIS</a>";
            }
            opts = __assign(__assign({}, options), { config: cfg });
            return [2 /*return*/, xyzTiles.create(map, opts, theme).then(function (xyz) {
                    xyz.registerOptionsUI = function (builder) {
                        builder
                            .addSelect({
                            path: 'config.server',
                            name: 'Server instance',
                            settings: {
                                options: publicServiceRegistry.selectOptions().options,
                            },
                        })
                            .addTextInput({
                            path: 'config.url',
                            name: 'URL template',
                            description: 'Must include {x}, {y} or {-y}, and {z} placeholders',
                            settings: {
                                placeholder: defaultXYZConfig.url,
                            },
                            showIf: function (cfg) { var _a; return ((_a = cfg.config) === null || _a === void 0 ? void 0 : _a.server) === CUSTOM_SERVICE; },
                        })
                            .addTextInput({
                            path: 'config.attribution',
                            name: 'Attribution',
                            settings: {
                                placeholder: defaultXYZConfig.attribution,
                            },
                            showIf: function (cfg) { var _a; return ((_a = cfg.config) === null || _a === void 0 ? void 0 : _a.server) === CUSTOM_SERVICE; },
                        });
                    };
                    return xyz;
                })];
        });
    }); },
    defaultOptions: {
        server: DEFAULT_SERVICE,
    },
};
export var esriLayers = [esriXYZTiles];
//# sourceMappingURL=esri.js.map