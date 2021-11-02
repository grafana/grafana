import { __assign } from "tslib";
import { prepareGraphableFrames, preparePlotConfigBuilder, preparePlotFrame } from './utils';
import { LegendDisplayMode, TooltipDisplayMode, VisibilityMode, GraphGradientMode, StackingMode, } from '@grafana/schema';
import { createTheme, DefaultTimeZone, EventBusSrv, FieldType, getDefaultTimeRange, MutableDataFrame, VizOrientation, } from '@grafana/data';
function mockDataFrame() {
    var df1 = new MutableDataFrame({
        refId: 'A',
        fields: [{ name: 'ts', type: FieldType.string, values: ['a', 'b', 'c'] }],
    });
    var df2 = new MutableDataFrame({
        refId: 'B',
        fields: [{ name: 'ts', type: FieldType.time, values: [1, 2, 4] }],
    });
    var f1Config = {
        displayName: 'Metric 1',
        decimals: 2,
        unit: 'm/s',
        custom: {
            gradientMode: GraphGradientMode.Opacity,
            lineWidth: 2,
            fillOpacity: 0.1,
        },
    };
    var f2Config = {
        displayName: 'Metric 2',
        decimals: 2,
        unit: 'kWh',
        custom: {
            gradientMode: GraphGradientMode.Hue,
            lineWidth: 2,
            fillOpacity: 0.1,
        },
    };
    df1.addField({
        name: 'metric1',
        type: FieldType.number,
        config: f1Config,
        state: {},
    });
    df2.addField({
        name: 'metric2',
        type: FieldType.number,
        config: f2Config,
        state: {},
    });
    return preparePlotFrame([df1, df2]);
}
jest.mock('@grafana/data', function () { return (__assign(__assign({}, jest.requireActual('@grafana/data')), { DefaultTimeZone: 'utc' })); });
describe('BarChart utils', function () {
    describe('preparePlotConfigBuilder', function () {
        var frame = mockDataFrame();
        var config = {
            orientation: VizOrientation.Auto,
            groupWidth: 20,
            barWidth: 2,
            showValue: VisibilityMode.Always,
            legend: {
                displayMode: LegendDisplayMode.List,
                placement: 'bottom',
                calcs: [],
            },
            stacking: StackingMode.None,
            tooltip: {
                mode: TooltipDisplayMode.None,
            },
            text: {
                valueSize: 10,
            },
            rawValue: function (seriesIdx, valueIdx) { return frame.fields[seriesIdx].values.get(valueIdx); },
        };
        it.each([VizOrientation.Auto, VizOrientation.Horizontal, VizOrientation.Vertical])('orientation', function (v) {
            var result = preparePlotConfigBuilder(__assign(__assign({}, config), { orientation: v, frame: frame, theme: createTheme(), timeZone: DefaultTimeZone, getTimeRange: getDefaultTimeRange, eventBus: new EventBusSrv(), allFrames: [frame] })).getConfig();
            expect(result).toMatchSnapshot();
        });
        it.each([VisibilityMode.Always, VisibilityMode.Auto])('value visibility', function (v) {
            expect(preparePlotConfigBuilder(__assign(__assign({}, config), { showValue: v, frame: frame, theme: createTheme(), timeZone: DefaultTimeZone, getTimeRange: getDefaultTimeRange, eventBus: new EventBusSrv(), allFrames: [frame] })).getConfig()).toMatchSnapshot();
        });
        it.each([StackingMode.None, StackingMode.Percent, StackingMode.Normal])('stacking', function (v) {
            expect(preparePlotConfigBuilder(__assign(__assign({}, config), { stacking: v, frame: frame, theme: createTheme(), timeZone: DefaultTimeZone, getTimeRange: getDefaultTimeRange, eventBus: new EventBusSrv(), allFrames: [frame] })).getConfig()).toMatchSnapshot();
        });
    });
    describe('prepareGraphableFrames', function () {
        it('will warn when there is no data in the response', function () {
            var result = prepareGraphableFrames([], createTheme(), { stacking: StackingMode.None });
            expect(result.warn).toEqual('No data in response');
        });
        it('will warn when there is no string field in the response', function () {
            var df = new MutableDataFrame({
                fields: [
                    { name: 'a', type: FieldType.time, values: [1, 2, 3, 4, 5] },
                    { name: 'value', values: [1, 2, 3, 4, 5] },
                ],
            });
            var result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None });
            expect(result.warn).toEqual('Bar charts requires a string field');
            expect(result.frames).toBeUndefined();
        });
        it('will warn when there are no numeric fields in the response', function () {
            var df = new MutableDataFrame({
                fields: [
                    { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
                    { name: 'value', type: FieldType.boolean, values: [true, true, true, true, true] },
                ],
            });
            var result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None });
            expect(result.warn).toEqual('No numeric fields found');
            expect(result.frames).toBeUndefined();
        });
        it('will convert NaN and Infinty to nulls', function () {
            var df = new MutableDataFrame({
                fields: [
                    { name: 'a', type: FieldType.string, values: ['a', 'b', 'c', 'd', 'e'] },
                    { name: 'value', values: [-10, NaN, 10, -Infinity, +Infinity] },
                ],
            });
            var result = prepareGraphableFrames([df], createTheme(), { stacking: StackingMode.None });
            var field = result.frames[0].fields[1];
            expect(field.values.toArray()).toMatchInlineSnapshot("\n      Array [\n        -10,\n        null,\n        10,\n        null,\n        null,\n      ]\n    ");
        });
        it('should sort fields when legend sortBy and sortDesc are set', function () {
            var frame = new MutableDataFrame({
                fields: [
                    { name: 'string', type: FieldType.string, values: ['a', 'b', 'c'] },
                    { name: 'a', values: [-10, 20, 10], state: { calcs: { min: -10 } } },
                    { name: 'b', values: [20, 20, 20], state: { calcs: { min: 20 } } },
                    { name: 'c', values: [10, 10, 10], state: { calcs: { min: 10 } } },
                ],
            });
            var resultAsc = prepareGraphableFrames([frame], createTheme(), {
                legend: { sortBy: 'Min', sortDesc: false },
            });
            expect(resultAsc.frames[0].fields[0].type).toBe(FieldType.string);
            expect(resultAsc.frames[0].fields[1].name).toBe('a');
            expect(resultAsc.frames[0].fields[2].name).toBe('c');
            expect(resultAsc.frames[0].fields[3].name).toBe('b');
            var resultDesc = prepareGraphableFrames([frame], createTheme(), {
                legend: { sortBy: 'Min', sortDesc: true },
            });
            expect(resultDesc.frames[0].fields[0].type).toBe(FieldType.string);
            expect(resultDesc.frames[0].fields[1].name).toBe('b');
            expect(resultDesc.frames[0].fields[2].name).toBe('c');
            expect(resultDesc.frames[0].fields[3].name).toBe('a');
        });
    });
});
//# sourceMappingURL=utils.test.js.map