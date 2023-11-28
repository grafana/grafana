import { config } from '@grafana/runtime';
import { prepareHeatmapData } from './fields';
import { quantizeScheme } from './palettes';
import { defaultOptions } from './types';
export class HeatmapSuggestionsSupplier {
    getSuggestionsForData(builder) {
        var _a;
        const { dataSummary } = builder;
        if (!((_a = builder.data) === null || _a === void 0 ? void 0 : _a.series) ||
            !dataSummary.hasData ||
            dataSummary.timeFieldCount < 1 ||
            dataSummary.numberFieldCount < 2 ||
            dataSummary.numberFieldCount > 10) {
            return;
        }
        const palette = quantizeScheme(defaultOptions.color, config.theme2);
        const info = prepareHeatmapData(builder.data.series, undefined, defaultOptions, palette, config.theme2);
        if (!info || info.warning) {
            return;
        }
        builder.getListAppender({
            name: '',
            pluginId: 'heatmap',
            options: {},
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
        });
    }
}
//# sourceMappingURL=suggestions.js.map