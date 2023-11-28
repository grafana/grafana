import { __awaiter } from "tslib";
import { Registry } from '@grafana/data';
import { xyzTiles, defaultXYZConfig } from './generic';
const CUSTOM_SERVICE = 'custom';
const DEFAULT_SERVICE = 'streets';
export const publicServiceRegistry = new Registry(() => [
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
]);
export const esriXYZTiles = {
    id: 'esri-xyz',
    name: 'ArcGIS MapServer',
    description: 'Add layer from an ESRI ArcGIS MapServer',
    isBaseMap: true,
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const cfg = Object.assign({}, options.config);
        const svc = publicServiceRegistry.getIfExists((_a = cfg.server) !== null && _a !== void 0 ? _a : DEFAULT_SERVICE);
        if (svc.id !== CUSTOM_SERVICE) {
            const base = 'https://services.arcgisonline.com/ArcGIS/rest/services/';
            cfg.url = `${base}${svc.slug}/MapServer/tile/{z}/{y}/{x}`;
            cfg.attribution = `Tiles © <a href="${base}${svc.slug}/MapServer">ArcGIS</a>`;
        }
        const opts = Object.assign(Object.assign({}, options), { config: cfg });
        return xyzTiles.create(map, opts, eventBus, theme).then((xyz) => {
            xyz.registerOptionsUI = (builder) => {
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
                    showIf: (cfg) => { var _a; return ((_a = cfg.config) === null || _a === void 0 ? void 0 : _a.server) === CUSTOM_SERVICE; },
                })
                    .addTextInput({
                    path: 'config.attribution',
                    name: 'Attribution',
                    settings: {
                        placeholder: defaultXYZConfig.attribution,
                    },
                    showIf: (cfg) => { var _a; return ((_a = cfg.config) === null || _a === void 0 ? void 0 : _a.server) === CUSTOM_SERVICE; },
                });
            };
            return xyz;
        });
    }),
    defaultOptions: {
        server: DEFAULT_SERVICE,
    },
};
export const esriLayers = [esriXYZTiles];
//# sourceMappingURL=esri.js.map