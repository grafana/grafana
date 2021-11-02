import { __assign } from "tslib";
import { MutableDataFrame } from '@grafana/data';
import { setDataSourceSrv, setTemplateSrv } from '@grafana/runtime';
import { createSpanLinkFactory } from './createSpanLink';
import { LinkSrv, setLinkSrv } from '../../../angular/panel/panellinks/link_srv';
import { TemplateSrv } from '../../templating/template_srv';
describe('createSpanLinkFactory', function () {
    it('returns undefined if there is no data source uid', function () {
        var splitOpenFn = jest.fn();
        var createLink = createSpanLinkFactory({ splitOpenFn: splitOpenFn });
        expect(createLink).not.toBeDefined();
    });
    describe('should return link', function () {
        beforeAll(function () {
            setDataSourceSrv({
                getInstanceSettings: function (uid) {
                    return { uid: 'loki1', name: 'loki1' };
                },
            });
            setLinkSrv(new LinkSrv());
            setTemplateSrv(new TemplateSrv());
        });
        it('with default keys when tags not configured', function () {
            var createLink = setupSpanLinkFactory();
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan());
            expect(linkDef.href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"}","refId":""}]}'));
        });
        it('with tags that passed in and without tags that are not in the span', function () {
            var createLink = setupSpanLinkFactory({
                tags: ['ip', 'newTag'],
            });
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan({
                process: {
                    serviceName: 'service',
                    tags: [
                        { key: 'hostname', value: 'hostname1' },
                        { key: 'ip', value: '192.168.0.1' },
                    ],
                },
            }));
            expect(linkDef.href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\"}","refId":""}]}'));
        });
        it('from tags and process tags as well', function () {
            var createLink = setupSpanLinkFactory({
                tags: ['ip', 'host'],
            });
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan({
                process: {
                    serviceName: 'service',
                    tags: [
                        { key: 'hostname', value: 'hostname1' },
                        { key: 'ip', value: '192.168.0.1' },
                    ],
                },
            }));
            expect(linkDef.href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{ip=\\"192.168.0.1\\", host=\\"host\\"}","refId":""}]}'));
        });
        it('with adjusted start and end time', function () {
            var createLink = setupSpanLinkFactory({
                spanStartTimeShift: '1m',
                spanEndTimeShift: '1m',
            });
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan({
                process: {
                    serviceName: 'service',
                    tags: [
                        { key: 'hostname', value: 'hostname1' },
                        { key: 'ip', value: '192.168.0.1' },
                    ],
                },
            }));
            expect(linkDef.href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"2020-10-14T01:01:00.000Z","to":"2020-10-14T01:01:01.000Z"},"datasource":"loki1","queries":[{"expr":"{hostname=\\"hostname1\\"}","refId":""}]}'));
        });
        it('filters by trace and span ID', function () {
            var createLink = setupSpanLinkFactory({
                filterBySpanID: true,
                filterByTraceID: true,
            });
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan());
            expect(linkDef.href).toBe("/explore?left=" + encodeURIComponent('{"range":{"from":"2020-10-14T01:00:00.000Z","to":"2020-10-14T01:00:01.000Z"},"datasource":"loki1","queries":[{"expr":"{cluster=\\"cluster1\\", hostname=\\"hostname1\\"} |=\\"7946b05c2e2e4e5a\\" |=\\"6605c7b08e715d6c\\"","refId":""}]}'));
        });
        it('creates link from dataFrame', function () {
            var splitOpenFn = jest.fn();
            var createLink = createSpanLinkFactory({
                splitOpenFn: splitOpenFn,
                dataFrame: new MutableDataFrame({
                    fields: [
                        { name: 'traceID', values: ['testTraceId'] },
                        {
                            name: 'spanID',
                            config: { links: [{ title: 'link', url: '${__data.fields.spanID}' }] },
                            values: ['testSpanId'],
                        },
                    ],
                }),
            });
            expect(createLink).toBeDefined();
            var linkDef = createLink(createTraceSpan());
            expect(linkDef.href).toBe('testSpanId');
        });
    });
});
function setupSpanLinkFactory(options) {
    if (options === void 0) { options = {}; }
    var splitOpenFn = jest.fn();
    return createSpanLinkFactory({
        splitOpenFn: splitOpenFn,
        traceToLogsOptions: __assign({ datasourceUid: 'lokiUid' }, options),
    });
}
function createTraceSpan(overrides) {
    if (overrides === void 0) { overrides = {}; }
    return __assign({ spanID: '6605c7b08e715d6c', traceID: '7946b05c2e2e4e5a', processID: 'processId', operationName: 'operation', logs: [], startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000, duration: 1000 * 1000, flags: 0, hasChildren: false, dataFrameRowIndex: 0, tags: [
            {
                key: 'host',
                value: 'host',
            },
        ], process: {
            serviceName: 'test service',
            tags: [
                {
                    key: 'cluster',
                    value: 'cluster1',
                },
                {
                    key: 'hostname',
                    value: 'hostname1',
                },
                {
                    key: 'label2',
                    value: 'val2',
                },
            ],
        } }, overrides);
}
//# sourceMappingURL=createSpanLink.test.js.map