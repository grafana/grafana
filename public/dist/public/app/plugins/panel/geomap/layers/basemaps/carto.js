import { __awaiter } from "tslib";
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
// https://carto.com/help/building-maps/basemap-list/
export var LayerTheme;
(function (LayerTheme) {
    LayerTheme["Auto"] = "auto";
    LayerTheme["Light"] = "light";
    LayerTheme["Dark"] = "dark";
})(LayerTheme || (LayerTheme = {}));
export const defaultCartoConfig = {
    theme: LayerTheme.Auto,
    showLabels: true,
};
export const carto = {
    id: 'carto',
    name: 'CARTO basemap',
    description: 'Add layer CARTO Raster basemaps',
    isBaseMap: true,
    defaultOptions: defaultCartoConfig,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: (map, options, eventBus, theme) => __awaiter(void 0, void 0, void 0, function* () {
        return ({
            init: () => {
                const cfg = Object.assign(Object.assign({}, defaultCartoConfig), options.config);
                let style = cfg.theme;
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
                        attributions: `<a href="https://carto.com/attribution/">© CARTO</a>`,
                        url: `https://{1-4}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`,
                    }),
                });
            },
            registerOptionsUI: (builder) => {
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
        });
    }),
};
export const cartoLayers = [carto];
//# sourceMappingURL=carto.js.map