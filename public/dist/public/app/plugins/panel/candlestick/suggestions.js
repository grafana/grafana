import { VisualizationSuggestionScore } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SuggestionName } from 'app/types/suggestions';
import { prepareCandlestickFields } from './fields';
import { defaultOptions } from './types';
export class CandlestickSuggestionsSupplier {
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
        const info = prepareCandlestickFields(builder.data.series, defaultOptions, config.theme2);
        if (!info) {
            return;
        }
        // Regular timeseries
        if (info.open === info.high && info.open === info.low) {
            return;
        }
        const list = builder.getListAppender({
            name: '',
            pluginId: 'candlestick',
            options: {},
            fieldConfig: {
                defaults: {
                    custom: {},
                },
                overrides: [],
            },
        });
        list.append({
            name: SuggestionName.Candlestick,
            options: defaultOptions,
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
            score: info.autoOpenClose ? VisualizationSuggestionScore.Good : VisualizationSuggestionScore.Best,
        });
    }
}
//# sourceMappingURL=suggestions.js.map