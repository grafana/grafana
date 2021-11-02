var e_1, _a;
import { __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import { FieldType, getDefaultTimeRange, LoadingState, toDataFrame, } from '@grafana/data';
import { config } from 'app/core/config';
import { SuggestionName } from 'app/types/suggestions';
import { getAllSuggestions, panelsToCheckFirst } from './getAllSuggestions';
jest.unmock('app/core/core');
jest.unmock('app/features/plugins/plugin_loader');
try {
    for (var panelsToCheckFirst_1 = __values(panelsToCheckFirst), panelsToCheckFirst_1_1 = panelsToCheckFirst_1.next(); !panelsToCheckFirst_1_1.done; panelsToCheckFirst_1_1 = panelsToCheckFirst_1.next()) {
        var pluginId = panelsToCheckFirst_1_1.value;
        config.panels[pluginId] = {
            module: "app/plugins/panel/" + pluginId + "/module",
        };
    }
}
catch (e_1_1) { e_1 = { error: e_1_1 }; }
finally {
    try {
        if (panelsToCheckFirst_1_1 && !panelsToCheckFirst_1_1.done && (_a = panelsToCheckFirst_1.return)) _a.call(panelsToCheckFirst_1);
    }
    finally { if (e_1) throw e_1.error; }
}
var ScenarioContext = /** @class */ (function () {
    function ScenarioContext() {
        this.data = [];
        this.suggestions = [];
    }
    ScenarioContext.prototype.setData = function (scenarioData) {
        var _this = this;
        this.data = scenarioData;
        beforeAll(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.run()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    };
    ScenarioContext.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var panelData, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        panelData = {
                            series: this.data,
                            state: LoadingState.Done,
                            timeRange: getDefaultTimeRange(),
                        };
                        _a = this;
                        return [4 /*yield*/, getAllSuggestions(panelData)];
                    case 1:
                        _a.suggestions = _b.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ScenarioContext.prototype.names = function () {
        return this.suggestions.map(function (x) { return x.name; });
    };
    return ScenarioContext;
}());
function scenario(name, setup) {
    describe(name, function () {
        var ctx = new ScenarioContext();
        setup(ctx);
    });
}
scenario('No series', function (ctx) {
    ctx.setData([]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([SuggestionName.Table, SuggestionName.TextPanel, SuggestionName.DashboardList]);
    });
});
scenario('No rows', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Time', type: FieldType.time, values: [] },
                { name: 'Max', type: FieldType.number, values: [] },
            ],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([SuggestionName.Table, SuggestionName.TextPanel, SuggestionName.DashboardList]);
    });
});
scenario('Single frame with time and number field', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
                { name: 'Max', type: FieldType.number, values: [1, 10, 50, 2, 5] },
            ],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([
            SuggestionName.LineChart,
            SuggestionName.LineChartSmooth,
            SuggestionName.AreaChart,
            SuggestionName.BarChart,
            SuggestionName.Gauge,
            SuggestionName.GaugeNoThresholds,
            SuggestionName.Stat,
            SuggestionName.StatColoredBackground,
            SuggestionName.BarGaugeBasic,
            SuggestionName.BarGaugeLCD,
            SuggestionName.Table,
            SuggestionName.StateTimeline,
        ]);
    });
    it('Bar chart suggestion should be using timeseries panel', function () {
        var _a;
        expect((_a = ctx.suggestions.find(function (x) { return x.name === SuggestionName.BarChart; })) === null || _a === void 0 ? void 0 : _a.pluginId).toBe('timeseries');
    });
    it('Stat panels have reduce values disabled', function () {
        var e_2, _a;
        var _b, _c;
        try {
            for (var _d = __values(ctx.suggestions), _e = _d.next(); !_e.done; _e = _d.next()) {
                var suggestion = _e.value;
                if ((_c = (_b = suggestion.options) === null || _b === void 0 ? void 0 : _b.reduceOptions) === null || _c === void 0 ? void 0 : _c.values) {
                    throw new Error("Suggestion " + suggestion.name + " reduce.values set to true when it should be false");
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_2) throw e_2.error; }
        }
    });
});
scenario('Single frame with time 2 number fields', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
                { name: 'ServerA', type: FieldType.number, values: [1, 10, 50, 2, 5] },
                { name: 'ServerB', type: FieldType.number, values: [1, 10, 50, 2, 5] },
            ],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([
            SuggestionName.LineChart,
            SuggestionName.LineChartSmooth,
            SuggestionName.AreaChartStacked,
            SuggestionName.AreaChartStackedPercent,
            SuggestionName.BarChartStacked,
            SuggestionName.BarChartStackedPercent,
            SuggestionName.Gauge,
            SuggestionName.GaugeNoThresholds,
            SuggestionName.Stat,
            SuggestionName.StatColoredBackground,
            SuggestionName.PieChart,
            SuggestionName.PieChartDonut,
            SuggestionName.BarGaugeBasic,
            SuggestionName.BarGaugeLCD,
            SuggestionName.Table,
            SuggestionName.StateTimeline,
        ]);
    });
    it('Stat panels have reduceOptions.values disabled', function () {
        var e_3, _a;
        var _b, _c;
        try {
            for (var _d = __values(ctx.suggestions), _e = _d.next(); !_e.done; _e = _d.next()) {
                var suggestion = _e.value;
                if ((_c = (_b = suggestion.options) === null || _b === void 0 ? void 0 : _b.reduceOptions) === null || _c === void 0 ? void 0 : _c.values) {
                    throw new Error("Suggestion " + suggestion.name + " reduce.values set to true when it should be false");
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_3) throw e_3.error; }
        }
    });
});
scenario('Single time series with 100 data points', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Time', type: FieldType.time, values: __spreadArray([], __read(Array(100).keys()), false) },
                { name: 'ServerA', type: FieldType.number, values: __spreadArray([], __read(Array(100).keys()), false) },
            ],
        }),
    ]);
    it('should not suggest bar chart', function () {
        expect(ctx.suggestions.find(function (x) { return x.name === SuggestionName.BarChart; })).toBe(undefined);
    });
});
scenario('30 time series with 100 data points', function (ctx) {
    ctx.setData(repeatFrame(30, toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: __spreadArray([], __read(Array(100).keys()), false) },
            { name: 'ServerA', type: FieldType.number, values: __spreadArray([], __read(Array(100).keys()), false) },
        ],
    })));
    it('should not suggest timeline', function () {
        expect(ctx.suggestions.find(function (x) { return x.pluginId === 'state-timeline'; })).toBe(undefined);
    });
});
scenario('50 time series with 100 data points', function (ctx) {
    ctx.setData(repeatFrame(50, toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: __spreadArray([], __read(Array(100).keys()), false) },
            { name: 'ServerA', type: FieldType.number, values: __spreadArray([], __read(Array(100).keys()), false) },
        ],
    })));
    it('should not suggest gauge', function () {
        expect(ctx.suggestions.find(function (x) { return x.pluginId === 'gauge'; })).toBe(undefined);
    });
});
scenario('Single frame with string and number field', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] },
                { name: 'ServerA', type: FieldType.number, values: [1, 2, 3] },
            ],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([
            SuggestionName.BarChart,
            SuggestionName.BarChartHorizontal,
            SuggestionName.Gauge,
            SuggestionName.GaugeNoThresholds,
            SuggestionName.Stat,
            SuggestionName.StatColoredBackground,
            SuggestionName.PieChart,
            SuggestionName.PieChartDonut,
            SuggestionName.BarGaugeBasic,
            SuggestionName.BarGaugeLCD,
            SuggestionName.Table,
        ]);
    });
    it('Stat/Gauge/BarGauge/PieChart panels to have reduceOptions.values enabled', function () {
        var e_4, _a;
        var _b, _c, _d;
        try {
            for (var _e = __values(ctx.suggestions), _f = _e.next(); !_f.done; _f = _e.next()) {
                var suggestion = _f.value;
                if (((_b = suggestion.options) === null || _b === void 0 ? void 0 : _b.reduceOptions) && !((_d = (_c = suggestion.options) === null || _c === void 0 ? void 0 : _c.reduceOptions) === null || _d === void 0 ? void 0 : _d.values)) {
                    throw new Error("Suggestion " + suggestion.name + " reduce.values set to false when it should be true");
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
            }
            finally { if (e_4) throw e_4.error; }
        }
    });
});
scenario('Single frame with string and 2 number field', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [
                { name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] },
                { name: 'ServerA', type: FieldType.number, values: [1, 2, 3] },
                { name: 'ServerB', type: FieldType.number, values: [1, 2, 3] },
            ],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([
            SuggestionName.BarChart,
            SuggestionName.BarChartStacked,
            SuggestionName.BarChartStackedPercent,
            SuggestionName.BarChartHorizontal,
            SuggestionName.BarChartHorizontalStacked,
            SuggestionName.BarChartHorizontalStackedPercent,
            SuggestionName.Gauge,
            SuggestionName.GaugeNoThresholds,
            SuggestionName.Stat,
            SuggestionName.StatColoredBackground,
            SuggestionName.PieChart,
            SuggestionName.PieChartDonut,
            SuggestionName.BarGaugeBasic,
            SuggestionName.BarGaugeLCD,
            SuggestionName.Table,
        ]);
    });
});
scenario('Single frame with string with only string field', function (ctx) {
    ctx.setData([
        toDataFrame({
            fields: [{ name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] }],
        }),
    ]);
    it('should return correct suggestions', function () {
        expect(ctx.names()).toEqual([SuggestionName.Stat, SuggestionName.StatColoredBackground, SuggestionName.Table]);
    });
    it('Stat panels have reduceOptions.fields set to show all fields', function () {
        var e_5, _a;
        var _b;
        try {
            for (var _c = __values(ctx.suggestions), _d = _c.next(); !_d.done; _d = _c.next()) {
                var suggestion = _d.value;
                if ((_b = suggestion.options) === null || _b === void 0 ? void 0 : _b.reduceOptions) {
                    expect(suggestion.options.reduceOptions.fields).toBe('/.*/');
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_5) throw e_5.error; }
        }
    });
});
function repeatFrame(count, frame) {
    var frames = [];
    for (var i = 0; i < count; i++) {
        frames.push(frame);
    }
    return frames;
}
//# sourceMappingURL=getAllSuggestions.test.js.map