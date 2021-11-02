import { __awaiter, __generator, __values } from "tslib";
import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';
export var panelsToCheckFirst = [
    'timeseries',
    'barchart',
    'gauge',
    'stat',
    'piechart',
    'bargauge',
    'table',
    'state-timeline',
    'text',
    'dashlist',
];
export function getAllSuggestions(data, panel) {
    return __awaiter(this, void 0, void 0, function () {
        var builder, panelsToCheckFirst_1, panelsToCheckFirst_1_1, pluginId, plugin, supplier, e_1_1;
        var e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    builder = new VisualizationSuggestionsBuilder(data, panel);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    panelsToCheckFirst_1 = __values(panelsToCheckFirst), panelsToCheckFirst_1_1 = panelsToCheckFirst_1.next();
                    _b.label = 2;
                case 2:
                    if (!!panelsToCheckFirst_1_1.done) return [3 /*break*/, 5];
                    pluginId = panelsToCheckFirst_1_1.value;
                    return [4 /*yield*/, importPanelPlugin(pluginId)];
                case 3:
                    plugin = _b.sent();
                    supplier = plugin.getSuggestionsSupplier();
                    if (supplier) {
                        supplier.getSuggestionsForData(builder);
                    }
                    _b.label = 4;
                case 4:
                    panelsToCheckFirst_1_1 = panelsToCheckFirst_1.next();
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 8];
                case 6:
                    e_1_1 = _b.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 8];
                case 7:
                    try {
                        if (panelsToCheckFirst_1_1 && !panelsToCheckFirst_1_1.done && (_a = panelsToCheckFirst_1.return)) _a.call(panelsToCheckFirst_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/, builder.getList()];
            }
        });
    });
}
//# sourceMappingURL=getAllSuggestions.js.map