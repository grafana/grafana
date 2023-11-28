import { __awaiter } from "tslib";
import { dateMath } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { addDataLinksToLogsResponse } from './datalinks';
describe('addDataLinksToLogsResponse', () => {
    const time = {
        from: dateMath.parse('2016-12-31 15:00:00Z', false),
        to: dateMath.parse('2016-12-31 16:00:00Z', false),
    };
    it('should add data links to response from log group names', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
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
        const mockOptions = {
            targets: [
                {
                    refId: 'A',
                    expression: 'stats count(@message) by bin(1h)',
                    logGroupNames: ['fake-log-group-one', 'fake-log-group-two'],
                    logGroups: [{}],
                    region: 'us-east-1',
                },
            ],
        };
        setDataSourceSrv({
            get() {
                return __awaiter(this, void 0, void 0, function* () {
                    return {
                        name: 'Xray',
                    };
                });
            },
        });
        yield addDataLinksToLogsResponse(mockResponse, mockOptions, Object.assign(Object.assign({}, time), { raw: time }), (s) => s !== null && s !== void 0 ? s : '', (v) => { var _a; return (_a = [v]) !== null && _a !== void 0 ? _a : []; }, (r) => r, 'xrayUid');
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
    }));
    it('should add data links to response from log groups, trimming :*', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
            data: [
                {
                    fields: [
                        {
                            name: '@message',
                            config: {},
                        },
                    ],
                    refId: 'A',
                },
            ],
        };
        const mockOptions = {
            targets: [
                {
                    refId: 'A',
                    expression: 'stats count(@message) by bin(1h)',
                    logGroupNames: [''],
                    logGroups: [
                        { arn: 'arn:aws:logs:us-east-1:111111111111:log-group:/aws/lambda/test:*' },
                        { arn: 'arn:aws:logs:us-east-2:222222222222:log-group:/ecs/prometheus:*' },
                    ],
                    region: 'us-east-1',
                },
            ],
        };
        yield addDataLinksToLogsResponse(mockResponse, mockOptions, Object.assign(Object.assign({}, time), { raw: time }), (s) => s !== null && s !== void 0 ? s : '', (v) => { var _a; return (_a = [v]) !== null && _a !== void 0 ? _a : []; }, (r) => r);
        expect(mockResponse).toMatchObject({
            data: [
                {
                    fields: [
                        {
                            name: '@message',
                            config: {
                                links: [
                                    {
                                        url: "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'stats*20count*28*40message*29*20by*20bin*281h*29~isLiveTail~false~source~(~'arn*3aaws*3alogs*3aus-east-1*3a111111111111*3alog-group*3a*2faws*2flambda*2ftest~'arn*3aaws*3alogs*3aus-east-2*3a222222222222*3alog-group*3a*2fecs*2fprometheus))",
                                        title: 'View in CloudWatch console',
                                    },
                                ],
                            },
                        },
                    ],
                    refId: 'A',
                },
            ],
        });
    }));
    it('should add data links to response from log groups, even without trimming :*', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockResponse = {
            data: [
                {
                    fields: [
                        {
                            name: '@message',
                            config: {},
                        },
                    ],
                    refId: 'A',
                },
            ],
        };
        const mockOptions = {
            targets: [
                {
                    refId: 'A',
                    expression: 'stats count(@message) by bin(1h)',
                    logGroupNames: [''],
                    logGroups: [{ arn: 'arn:aws:logs:us-east-1:111111111111:log-group:/aws/lambda/test' }],
                    region: 'us-east-1',
                },
            ],
        };
        yield addDataLinksToLogsResponse(mockResponse, mockOptions, Object.assign(Object.assign({}, time), { raw: time }), (s) => s !== null && s !== void 0 ? s : '', (v) => { var _a; return (_a = [v]) !== null && _a !== void 0 ? _a : []; }, (r) => r);
        expect(mockResponse).toMatchObject({
            data: [
                {
                    fields: [
                        {
                            name: '@message',
                            config: {
                                links: [
                                    {
                                        url: "https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logs-insights:queryDetail=~(end~'2016-12-31T16*3a00*3a00.000Z~start~'2016-12-31T15*3a00*3a00.000Z~timeType~'ABSOLUTE~tz~'UTC~editorString~'stats*20count*28*40message*29*20by*20bin*281h*29~isLiveTail~false~source~(~'arn*3aaws*3alogs*3aus-east-1*3a111111111111*3alog-group*3a*2faws*2flambda*2ftest))",
                                        title: 'View in CloudWatch console',
                                    },
                                ],
                            },
                        },
                    ],
                    refId: 'A',
                },
            ],
        });
    }));
});
//# sourceMappingURL=datalinks.test.js.map