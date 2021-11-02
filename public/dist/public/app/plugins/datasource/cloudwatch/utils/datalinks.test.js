import { __assign, __awaiter, __generator } from "tslib";
import { dateMath } from '@grafana/data';
import { addDataLinksToLogsResponse } from './datalinks';
import { setDataSourceSrv } from '@grafana/runtime';
describe('addDataLinksToLogsResponse', function () {
    it('should add data links to response', function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockResponse, mockOptions, time;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockResponse = {
                        data: [
                            {
                                fields: [
                                    {
                                        name: '@message',
                                        config: {},
                                    },
                                    {
                                        name: '@xrayTraceId',
                                        config: {},
                                    },
                                ],
                                refId: 'A',
                            },
                        ],
                    };
                    mockOptions = {
                        targets: [
                            {
                                refId: 'A',
                                expression: 'stats count(@message) by bin(1h)',
                                logGroupNames: ['fake-log-group-one', 'fake-log-group-two'],
                                region: 'us-east-1',
                            },
                        ],
                    };
                    time = {
                        from: dateMath.parse('2016-12-31 15:00:00Z', false),
                        to: dateMath.parse('2016-12-31 16:00:00Z', false),
                    };
                    setDataSourceSrv({
                        get: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, {
                                            name: 'Xray',
                                        }];
                                });
                            });
                        },
                    });
                    return [4 /*yield*/, addDataLinksToLogsResponse(mockResponse, mockOptions, __assign(__assign({}, time), { raw: time }), function (s) { return s !== null && s !== void 0 ? s : ''; }, function (r) { return r; }, 'xrayUid')];
                case 1:
                    _a.sent();
                    expect(mockResponse).toMatchObject({
                        data: [
                            {
                                fields: [
                                    {
                                        name: '@message',
                                        config: {
                                            links: [
                                                {
                                                    url: "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'stats*20count*28*40message*29*20by*20bin*281h*29~isLiveTail~false~source~(~'fake-log-group-one~'fake-log-group-two))",
                                                    title: 'View in CloudWatch console',
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        name: '@xrayTraceId',
                                        config: {
                                            links: [
                                                {
                                                    url: '',
                                                    title: 'Xray',
                                                    internal: {
                                                        query: { query: '${__value.raw}', region: 'us-east-1', queryType: 'getTrace' },
                                                        datasourceUid: 'xrayUid',
                                                        datasourceName: 'Xray',
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                                refId: 'A',
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=datalinks.test.js.map