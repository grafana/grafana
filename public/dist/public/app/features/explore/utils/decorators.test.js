import { __assign, __awaiter, __generator } from "tslib";
import { GraphDrawStyle, StackingMode } from '@grafana/schema';
import { lastValueFrom } from 'rxjs';
import { ArrayVector, FieldColorModeId, FieldType, LoadingState, toDataFrame, } from '@grafana/data';
import { decorateWithFrameTypeMetadata, decorateWithGraphResult, decorateWithLogsResult, decorateWithTableResult, } from './decorators';
import { describe } from '../../../../test/lib/common';
import TableModel from 'app/core/table_model';
jest.mock('@grafana/data/src/datetime/formatter', function () { return ({
    dateTimeFormat: function () { return 'format() jest mocked'; },
    dateTimeFormatTimeAgo: function (ts) { return 'fromNow() jest mocked'; },
}); });
var getTestContext = function () {
    var timeSeries = toDataFrame({
        name: 'A-series',
        refId: 'A',
        meta: {
            preferredVisualisationType: 'graph',
        },
        fields: [
            { name: 'time', type: FieldType.time, values: [100, 200, 300] },
            { name: 'A-series', type: FieldType.number, values: [4, 5, 6] },
            { name: 'B-series', type: FieldType.number, values: [7, 8, 9] },
        ],
    });
    var table = toDataFrame({
        name: 'table-res',
        refId: 'A',
        fields: [
            { name: 'value', type: FieldType.number, values: [4, 5, 6] },
            { name: 'time', type: FieldType.time, values: [100, 100, 100] },
            { name: 'tsNs', type: FieldType.time, values: ['100000002', undefined, '100000001'] },
            { name: 'message', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
        ],
    });
    var emptyTable = toDataFrame({ name: 'empty-table', refId: 'A', fields: [] });
    var logs = toDataFrame({
        name: 'logs-res',
        refId: 'A',
        fields: [
            { name: 'value', type: FieldType.number, values: [4, 5, 6] },
            { name: 'time', type: FieldType.time, values: [100, 100, 100] },
            { name: 'tsNs', type: FieldType.time, values: ['100000002', undefined, '100000001'] },
            { name: 'message', type: FieldType.string, values: ['this is a message', 'second message', 'third'] },
        ],
        meta: { preferredVisualisationType: 'logs' },
    });
    return { emptyTable: emptyTable, timeSeries: timeSeries, logs: logs, table: table };
};
var createExplorePanelData = function (args) {
    var defaults = {
        series: [],
        timeRange: {},
        state: LoadingState.Done,
        graphFrames: [],
        graphResult: undefined,
        logsFrames: [],
        logsResult: undefined,
        tableFrames: [],
        tableResult: undefined,
        traceFrames: [],
        nodeGraphFrames: [],
    };
    return __assign(__assign({}, defaults), args);
};
describe('decorateWithGraphLogsTraceAndTable', function () {
    it('should correctly classify the dataFrames', function () {
        var _a = getTestContext(), table = _a.table, logs = _a.logs, timeSeries = _a.timeSeries, emptyTable = _a.emptyTable;
        var series = [table, logs, timeSeries, emptyTable];
        var panelData = {
            series: series,
            state: LoadingState.Done,
            timeRange: {},
        };
        expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
            series: series,
            state: LoadingState.Done,
            timeRange: {},
            graphFrames: [timeSeries],
            tableFrames: [table, emptyTable],
            logsFrames: [logs],
            traceFrames: [],
            nodeGraphFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
        });
    });
    it('should handle empty array', function () {
        var series = [];
        var panelData = {
            series: series,
            state: LoadingState.Done,
            timeRange: {},
        };
        expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
            series: [],
            state: LoadingState.Done,
            timeRange: {},
            graphFrames: [],
            tableFrames: [],
            logsFrames: [],
            traceFrames: [],
            nodeGraphFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
        });
    });
    it('should return frames even if there is an error', function () {
        var _a = getTestContext(), timeSeries = _a.timeSeries, logs = _a.logs, table = _a.table;
        var series = [timeSeries, logs, table];
        var panelData = {
            series: series,
            error: {},
            state: LoadingState.Error,
            timeRange: {},
        };
        expect(decorateWithFrameTypeMetadata(panelData)).toEqual({
            series: [timeSeries, logs, table],
            error: {},
            state: LoadingState.Error,
            timeRange: {},
            graphFrames: [timeSeries],
            tableFrames: [table],
            logsFrames: [logs],
            traceFrames: [],
            nodeGraphFrames: [],
            graphResult: null,
            tableResult: null,
            logsResult: null,
        });
    });
});
describe('decorateWithGraphResult', function () {
    it('should process the graph dataFrames', function () {
        var timeSeries = getTestContext().timeSeries;
        var panelData = createExplorePanelData({ graphFrames: [timeSeries] });
        expect(decorateWithGraphResult(panelData).graphResult).toMatchObject([timeSeries]);
    });
    it('returns null if it gets empty array', function () {
        var panelData = createExplorePanelData({ graphFrames: [] });
        expect(decorateWithGraphResult(panelData).graphResult).toBeNull();
    });
    it('returns data if panelData has error', function () {
        var timeSeries = getTestContext().timeSeries;
        var panelData = createExplorePanelData({ error: {}, graphFrames: [timeSeries] });
        expect(decorateWithGraphResult(panelData).graphResult).toMatchObject([timeSeries]);
    });
});
describe('decorateWithTableResult', function () {
    it('should process table type dataFrame', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, table, emptyTable, panelData, panelResult, theResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = getTestContext(), table = _a.table, emptyTable = _a.emptyTable;
                    panelData = createExplorePanelData({ tableFrames: [table, emptyTable] });
                    return [4 /*yield*/, lastValueFrom(decorateWithTableResult(panelData))];
                case 1:
                    panelResult = _b.sent();
                    theResult = panelResult.tableResult;
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.fields[0].name).toEqual('value');
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.fields[1].name).toEqual('time');
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.fields[2].name).toEqual('tsNs');
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.fields[3].name).toEqual('message');
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.fields[1].display).not.toBeNull();
                    expect(theResult === null || theResult === void 0 ? void 0 : theResult.length).toBe(3);
                    // I don't understand the purpose of the code below, feels like this belongs in toDataFrame tests?
                    // Same data though a DataFrame
                    theResult = toDataFrame(new TableModel({
                        columns: [
                            { text: 'value', type: 'number' },
                            { text: 'time', type: 'time' },
                            { text: 'tsNs', type: 'time' },
                            { text: 'message', type: 'string' },
                        ],
                        rows: [
                            [4, 100, '100000000', 'this is a message'],
                            [5, 200, '100000000', 'second message'],
                            [6, 300, '100000000', 'third'],
                        ],
                        type: 'table',
                    }));
                    expect(theResult.fields[0].name).toEqual('value');
                    expect(theResult.fields[1].name).toEqual('time');
                    expect(theResult.fields[2].name).toEqual('tsNs');
                    expect(theResult.fields[3].name).toEqual('message');
                    expect(theResult.fields[1].display).not.toBeNull();
                    expect(theResult.length).toBe(3);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should do join transform if all series are timeseries', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tableFrames, panelData, panelResult, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tableFrames = [
                        toDataFrame({
                            name: 'A-series',
                            refId: 'A',
                            fields: [
                                { name: 'Time', type: FieldType.time, values: [100, 200, 300] },
                                { name: 'A-series', type: FieldType.number, values: [4, 5, 6] },
                            ],
                        }),
                        toDataFrame({
                            name: 'B-series',
                            refId: 'B',
                            fields: [
                                { name: 'Time', type: FieldType.time, values: [100, 200, 300] },
                                { name: 'B-series', type: FieldType.number, values: [4, 5, 6] },
                            ],
                        }),
                    ];
                    panelData = createExplorePanelData({ tableFrames: tableFrames });
                    return [4 /*yield*/, lastValueFrom(decorateWithTableResult(panelData))];
                case 1:
                    panelResult = _a.sent();
                    result = panelResult.tableResult;
                    expect(result === null || result === void 0 ? void 0 : result.fields[0].name).toBe('Time');
                    expect(result === null || result === void 0 ? void 0 : result.fields[1].name).toBe('A-series');
                    expect(result === null || result === void 0 ? void 0 : result.fields[2].name).toBe('B-series');
                    expect(result === null || result === void 0 ? void 0 : result.fields[0].values.toArray()).toEqual([100, 200, 300]);
                    expect(result === null || result === void 0 ? void 0 : result.fields[1].values.toArray()).toEqual([4, 5, 6]);
                    expect(result === null || result === void 0 ? void 0 : result.fields[2].values.toArray()).toEqual([4, 5, 6]);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not override fields display property when filled', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tableFrames, displayFunctionMock, panelData, panelResult;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    tableFrames = [
                        toDataFrame({
                            name: 'A-series',
                            refId: 'A',
                            fields: [{ name: 'Text', type: FieldType.string, values: ['someText'] }],
                        }),
                    ];
                    displayFunctionMock = jest.fn();
                    tableFrames[0].fields[0].display = displayFunctionMock;
                    panelData = createExplorePanelData({ tableFrames: tableFrames });
                    return [4 /*yield*/, lastValueFrom(decorateWithTableResult(panelData))];
                case 1:
                    panelResult = _b.sent();
                    expect((_a = panelResult.tableResult) === null || _a === void 0 ? void 0 : _a.fields[0].display).toBe(displayFunctionMock);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should return null when passed empty array', function () { return __awaiter(void 0, void 0, void 0, function () {
        var panelData, panelResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    panelData = createExplorePanelData({ tableFrames: [] });
                    return [4 /*yield*/, lastValueFrom(decorateWithTableResult(panelData))];
                case 1:
                    panelResult = _a.sent();
                    expect(panelResult.tableResult).toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
    it('returns data if panelData has error', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, table, emptyTable, panelData, panelResult;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = getTestContext(), table = _a.table, emptyTable = _a.emptyTable;
                    panelData = createExplorePanelData({ error: {}, tableFrames: [table, emptyTable] });
                    return [4 /*yield*/, lastValueFrom(decorateWithTableResult(panelData))];
                case 1:
                    panelResult = _b.sent();
                    expect(panelResult.tableResult).not.toBeNull();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('decorateWithLogsResult', function () {
    it('should correctly transform logs dataFrames', function () {
        var logs = getTestContext().logs;
        var request = { timezone: 'utc', intervalMs: 60000 };
        var panelData = createExplorePanelData({ logsFrames: [logs], request: request });
        expect(decorateWithLogsResult()(panelData).logsResult).toEqual({
            hasUniqueLabels: false,
            meta: [],
            rows: [
                {
                    rowIndex: 0,
                    dataFrame: logs,
                    entry: 'this is a message',
                    entryFieldIndex: 3,
                    hasAnsi: false,
                    hasUnescapedContent: false,
                    labels: {},
                    logLevel: 'unknown',
                    raw: 'this is a message',
                    searchWords: [],
                    timeEpochMs: 100,
                    timeEpochNs: '100000002',
                    timeFromNow: 'fromNow() jest mocked',
                    timeLocal: 'format() jest mocked',
                    timeUtc: 'format() jest mocked',
                    uid: '0',
                    uniqueLabels: {},
                },
                {
                    rowIndex: 2,
                    dataFrame: logs,
                    entry: 'third',
                    entryFieldIndex: 3,
                    hasAnsi: false,
                    hasUnescapedContent: false,
                    labels: {},
                    logLevel: 'unknown',
                    raw: 'third',
                    searchWords: [],
                    timeEpochMs: 100,
                    timeEpochNs: '100000001',
                    timeFromNow: 'fromNow() jest mocked',
                    timeLocal: 'format() jest mocked',
                    timeUtc: 'format() jest mocked',
                    uid: '2',
                    uniqueLabels: {},
                },
                {
                    rowIndex: 1,
                    dataFrame: logs,
                    entry: 'second message',
                    entryFieldIndex: 3,
                    hasAnsi: false,
                    hasUnescapedContent: false,
                    labels: {},
                    logLevel: 'unknown',
                    raw: 'second message',
                    searchWords: [],
                    timeEpochMs: 100,
                    timeEpochNs: '100000000',
                    timeFromNow: 'fromNow() jest mocked',
                    timeLocal: 'format() jest mocked',
                    timeUtc: 'format() jest mocked',
                    uid: '1',
                    uniqueLabels: {},
                },
            ],
            series: [
                {
                    name: 'unknown',
                    length: 1,
                    fields: [
                        { name: 'Time', type: 'time', values: new ArrayVector([0]), config: {} },
                        {
                            name: 'Value',
                            type: 'number',
                            labels: undefined,
                            values: new ArrayVector([3]),
                            config: {
                                color: {
                                    fixedColor: '#8e8e8e',
                                    mode: FieldColorModeId.Fixed,
                                },
                                min: 0,
                                decimals: 0,
                                unit: undefined,
                                custom: {
                                    drawStyle: GraphDrawStyle.Bars,
                                    barAlignment: 0,
                                    barMaxWidth: 5,
                                    barWidthFactor: 0.9,
                                    lineColor: '#8e8e8e',
                                    fillColor: '#8e8e8e',
                                    pointColor: '#8e8e8e',
                                    lineWidth: 0,
                                    fillOpacity: 100,
                                    stacking: { mode: StackingMode.Normal, group: 'A' },
                                },
                            },
                        },
                    ],
                },
            ],
            visibleRange: undefined,
        });
    });
    it('returns null if passed empty array', function () {
        var panelData = createExplorePanelData({ logsFrames: [] });
        expect(decorateWithLogsResult()(panelData).logsResult).toBeNull();
    });
    it('returns data if panelData has error', function () {
        var logs = getTestContext().logs;
        var panelData = createExplorePanelData({ error: {}, logsFrames: [logs] });
        expect(decorateWithLogsResult()(panelData).logsResult).not.toBeNull();
    });
});
//# sourceMappingURL=decorators.test.js.map