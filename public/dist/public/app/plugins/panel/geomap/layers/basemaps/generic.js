import { __awaiter } from "tslib";
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
const sampleURL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer';
export const defaultXYZConfig = {
    url: sampleURL + '/tile/{z}/{y}/{x}',
    attribution: `Tiles © <a href="${sampleURL}">ArcGIS</a>`,
};
export const xyzTiles = {
    id: 'xyz',
    name: 'XYZ Tile layer',
    description: 'Add map from a generic tile layer',
    isBaseMap: true,
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        return ({
            init: () => {
                var _a;
                const cfg = Object.assign({}, options.config);
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
            registerOptionsUI: (builder) => {
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
        });
    }),
};
export const genericLayers = [xyzTiles];
//# sourceMappingURL=generic.js.map