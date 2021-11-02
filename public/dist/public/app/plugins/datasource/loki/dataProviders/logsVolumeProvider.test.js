import { __awaiter, __generator } from "tslib";
import { MockObservableDataSourceApi } from '../../../../../test/mocks/datasource_srv';
import { createLokiLogsVolumeProvider } from './logsVolumeProvider';
import { FieldType, LoadingState, toDataFrame } from '@grafana/data';
function createFrame(labels, timestamps, values) {
    return toDataFrame({
        fields: [
            { name: 'Time', type: FieldType.time, values: timestamps },
            {
                name: 'Number',
                type: FieldType.number,
                values: values,
                labels: labels,
            },
        ],
    });
}
function createExpectedFields(levelName, timestamps, values) {
    return [
        { name: 'Time', values: { buffer: timestamps } },
        {
            name: 'Value',
            config: { displayNameFromDS: levelName },
            values: { buffer: values },
        },
    ];
}
describe('LokiLogsVolumeProvider', function () {
    var volumeProvider, datasource, request;
    function setup(datasourceSetup) {
        datasourceSetup();
        request = {
            targets: [{ expr: '{app="app01"}' }, { expr: '{app="app02"}' }],
            range: { from: 0, to: 1 },
            scopedVars: {
                __interval_ms: {
                    value: 1000,
                },
            },
        };
        volumeProvider = createLokiLogsVolumeProvider(datasource, request);
    }
    function setupMultipleResults() {
        // level=unknown
        var resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5]);
        // level=error
        var resultAFrame2 = createFrame({ app: 'app01', level: 'error' }, [100, 200, 300], [0, 1, 0]);
        // level=unknown
        var resultBFrame1 = createFrame({ app: 'app02' }, [100, 200, 300], [1, 2, 3]);
        // level=error
        var resultBFrame2 = createFrame({ app: 'app02', level: 'error' }, [100, 200, 300], [1, 1, 1]);
        datasource = new MockObservableDataSourceApi('loki', [
            {
                data: [resultAFrame1, resultAFrame2],
            },
            {
                data: [resultBFrame1, resultBFrame2],
            },
        ]);
    }
    function setupErrorResponse() {
        datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
    }
    it('aggregates data frames by level', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup(setupMultipleResults);
                    return [4 /*yield*/, expect(volumeProvider).toEmitValuesWith(function (received) {
                            expect(received).toMatchObject([
                                { state: LoadingState.Loading, error: undefined, data: [] },
                                {
                                    state: LoadingState.Done,
                                    error: undefined,
                                    data: [
                                        {
                                            fields: createExpectedFields('unknown', [100, 200, 300], [6, 7, 8]),
                                        },
                                        {
                                            fields: createExpectedFields('error', [100, 200, 300], [1, 2, 1]),
                                        },
                                    ],
                                },
                            ]);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('returns error', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup(setupErrorResponse);
                    return [4 /*yield*/, expect(volumeProvider).toEmitValuesWith(function (received) {
                            expect(received).toMatchObject([
                                { state: LoadingState.Loading, error: undefined, data: [] },
                                {
                                    state: LoadingState.Error,
                                    error: 'Error message',
                                    data: [],
                                },
                                'Error message',
                            ]);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=logsVolumeProvider.test.js.map