import { __assign, __makeTemplateObject } from "tslib";
import { FieldType, locationUtil, toDataFrame, VariableOrigin } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { getDataFrameVars, LinkSrv } from '../link_srv';
import { getTimeSrv, setTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { variableAdapters } from 'app/features/variables/adapters';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';
import { updateConfig } from '../../../../core/config';
import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';
jest.mock('app/core/core', function () { return ({
    appEvents: {
        subscribe: function () { },
    },
}); });
describe('linkSrv', function () {
    var linkSrv;
    var templateSrv;
    var originalTimeService;
    function initLinkSrv() {
        var _dashboard = {
            time: { from: 'now-6h', to: 'now' },
            getTimezone: jest.fn(function () { return 'browser'; }),
            timeRangeUpdated: function () { },
        };
        var timeSrv = new TimeSrv({});
        timeSrv.init(_dashboard);
        timeSrv.setTime({ from: 'now-1h', to: 'now' });
        _dashboard.refresh = false;
        setTimeSrv(timeSrv);
        templateSrv = initTemplateSrv([
            { type: 'query', name: 'home', current: { value: '127.0.0.1' } },
            { type: 'query', name: 'server1', current: { value: '192.168.0.100' } },
        ]);
        setTemplateSrv(templateSrv);
        linkSrv = new LinkSrv();
    }
    beforeAll(function () {
        originalTimeService = getTimeSrv();
        variableAdapters.register(createQueryVariableAdapter());
    });
    beforeEach(function () {
        initLinkSrv();
        jest.resetAllMocks();
    });
    afterAll(function () {
        setTimeSrv(originalTimeService);
    });
    describe('getDataLinkUIModel', function () {
        describe('built in variables', function () {
            it('should not trim white space from data links', function () {
                expect(linkSrv.getDataLinkUIModel({
                    title: 'White space',
                    url: 'www.google.com?query=some query',
                }, function (v) { return v; }, {}).href).toEqual('www.google.com?query=some query');
            });
            it('should remove new lines from data link', function () {
                expect(linkSrv.getDataLinkUIModel({
                    title: 'New line',
                    url: 'www.google.com?query=some\nquery',
                }, function (v) { return v; }, {}).href).toEqual('www.google.com?query=somequery');
            });
        });
        describe('sanitization', function () {
            var url = "javascript:alert('broken!);";
            it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        disableSanitizeHtml | expected\n        ", "             | ", "\n        ", "            | ", "\n      "], ["\n        disableSanitizeHtml | expected\n        ", "             | ", "\n        ", "            | ", "\n      "])), true, url, false, 'about:blank')("when disable disableSanitizeHtml set to '$disableSanitizeHtml' then result should be '$expected'", function (_a) {
                var disableSanitizeHtml = _a.disableSanitizeHtml, expected = _a.expected;
                updateConfig({
                    disableSanitizeHtml: disableSanitizeHtml,
                });
                var link = linkSrv.getDataLinkUIModel({
                    title: 'Any title',
                    url: url,
                }, function (v) { return v; }, {}).href;
                expect(link).toBe(expected);
            });
        });
        describe('Building links with root_url set', function () {
            it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        url                 | appSubUrl     | expected\n        ", "         | ", " | ", "\n        ", " | ", " | ", "\n        ", "     | ", " | ", "\n        ", "         | ", "         | ", "\n        ", " | ", "         | ", "\n        ", "     | ", "         | ", "\n      "], ["\n        url                 | appSubUrl     | expected\n        ", "         | ", " | ", "\n        ", " | ", " | ", "\n        ", "     | ", " | ", "\n        ", "         | ", "         | ", "\n        ", " | ", "         | ", "\n        ", "     | ", "         | ", "\n      "])), '/d/XXX', '/grafana', '/grafana/d/XXX', '/grafana/d/XXX', '/grafana', '/grafana/d/XXX', 'd/whatever', '/grafana', 'd/whatever', '/d/XXX', '', '/d/XXX', '/grafana/d/XXX', '', '/grafana/d/XXX', 'd/whatever', '', 'd/whatever')("when link '$url' and config.appSubUrl set to '$appSubUrl' then result should be '$expected'", function (_a) {
                var url = _a.url, appSubUrl = _a.appSubUrl, expected = _a.expected;
                locationUtil.initialize({
                    config: { appSubUrl: appSubUrl },
                    getVariablesUrlParams: (function () { }),
                    getTimeRangeForUrl: (function () { }),
                });
                var link = linkSrv.getDataLinkUIModel({
                    title: 'Any title',
                    url: url,
                }, function (v) { return v; }, {}).href;
                expect(link).toBe(expected);
            });
        });
    });
    describe('getAnchorInfo', function () {
        it('returns variable values for variable names in link.href and link.tooltip', function () {
            jest.spyOn(linkSrv, 'getLinkUrl');
            jest.spyOn(templateSrv, 'replace');
            expect(linkSrv.getLinkUrl).toBeCalledTimes(0);
            expect(templateSrv.replace).toBeCalledTimes(0);
            var link = linkSrv.getAnchorInfo({
                type: 'link',
                icon: 'dashboard',
                tags: [],
                url: '/graph?home=$home',
                title: 'Visit home',
                tooltip: 'Visit ${home:raw}',
            });
            expect(linkSrv.getLinkUrl).toBeCalledTimes(1);
            expect(templateSrv.replace).toBeCalledTimes(3);
            expect(link).toStrictEqual({ href: '/graph?home=127.0.0.1', title: 'Visit home', tooltip: 'Visit 127.0.0.1' });
        });
    });
    describe('getLinkUrl', function () {
        it('converts link urls', function () {
            var linkUrl = linkSrv.getLinkUrl({
                url: '/graph',
            });
            var linkUrlWithVar = linkSrv.getLinkUrl({
                url: '/graph?home=$home',
            });
            expect(linkUrl).toBe('/graph');
            expect(linkUrlWithVar).toBe('/graph?home=127.0.0.1');
        });
        it('appends current dashboard time range if keepTime is true', function () {
            var anchorInfoKeepTime = linkSrv.getLinkUrl({
                keepTime: true,
                url: '/graph',
            });
            expect(anchorInfoKeepTime).toBe('/graph?from=now-1h&to=now');
        });
        it('adds all variables to the url if includeVars is true', function () {
            var anchorInfoIncludeVars = linkSrv.getLinkUrl({
                includeVars: true,
                url: '/graph',
            });
            expect(anchorInfoIncludeVars).toBe('/graph?var-home=127.0.0.1&var-server1=192.168.0.100');
        });
        it('respects config disableSanitizeHtml', function () {
            var anchorInfo = {
                url: 'javascript:alert(document.domain)',
            };
            expect(linkSrv.getLinkUrl(anchorInfo)).toBe('about:blank');
            updateConfig({
                disableSanitizeHtml: true,
            });
            expect(linkSrv.getLinkUrl(anchorInfo)).toBe(anchorInfo.url);
        });
    });
});
describe('getDataFrameVars', function () {
    describe('when called with a DataFrame that contains fields without nested path', function () {
        it('then it should return correct suggestions', function () {
            var frame = toDataFrame({
                name: 'indoor',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'temperature', type: FieldType.number, values: [10, 11, 12] },
                ],
            });
            var suggestions = getDataFrameVars([frame]);
            expect(suggestions).toEqual([
                {
                    value: '__data.fields.time',
                    label: 'time',
                    documentation: "Formatted value for time on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: '__data.fields.temperature',
                    label: 'temperature',
                    documentation: "Formatted value for temperature on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[0]",
                    label: "Select by index",
                    documentation: "Enter the field order",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields.temperature.numeric",
                    label: "Show numeric value",
                    documentation: "the numeric field value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields.temperature.text",
                    label: "Show text value",
                    documentation: "the text value",
                    origin: VariableOrigin.Fields,
                },
            ]);
        });
    });
    describe('when called with a DataFrame that contains fields with nested path', function () {
        it('then it should return correct suggestions', function () {
            var frame = toDataFrame({
                name: 'temperatures',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
                ],
            });
            var suggestions = getDataFrameVars([frame]);
            expect(suggestions).toEqual([
                {
                    value: '__data.fields.time',
                    label: 'time',
                    documentation: "Formatted value for time on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: '__data.fields["temperature.indoor"]',
                    label: 'temperature.indoor',
                    documentation: "Formatted value for temperature.indoor on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[0]",
                    label: "Select by index",
                    documentation: "Enter the field order",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"temperature.indoor\"].numeric",
                    label: "Show numeric value",
                    documentation: "the numeric field value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"temperature.indoor\"].text",
                    label: "Show text value",
                    documentation: "the text value",
                    origin: VariableOrigin.Fields,
                },
            ]);
        });
    });
    describe('when called with a DataFrame that contains fields with displayName', function () {
        it('then it should return correct suggestions', function () {
            var frame = toDataFrame({
                name: 'temperatures',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
                ],
            });
            frame.fields[1].config = __assign(__assign({}, frame.fields[1].config), { displayName: 'Indoor Temperature' });
            var suggestions = getDataFrameVars([frame]);
            expect(suggestions).toEqual([
                {
                    value: '__data.fields.time',
                    label: 'time',
                    documentation: "Formatted value for time on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: '__data.fields["Indoor Temperature"]',
                    label: 'Indoor Temperature',
                    documentation: "Formatted value for Indoor Temperature on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[0]",
                    label: "Select by index",
                    documentation: "Enter the field order",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"].numeric",
                    label: "Show numeric value",
                    documentation: "the numeric field value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"].text",
                    label: "Show text value",
                    documentation: "the text value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"]",
                    label: "Select by title",
                    documentation: "Use the title to pick the field",
                    origin: VariableOrigin.Fields,
                },
            ]);
        });
    });
    describe('when called with a DataFrame that contains fields with duplicate names', function () {
        it('then it should ignore duplicates', function () {
            var frame = toDataFrame({
                name: 'temperatures',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'temperature.indoor', type: FieldType.number, values: [10, 11, 12] },
                    { name: 'temperature.outdoor', type: FieldType.number, values: [20, 21, 22] },
                ],
            });
            frame.fields[1].config = __assign(__assign({}, frame.fields[1].config), { displayName: 'Indoor Temperature' });
            // Someone makes a mistake when renaming a field
            frame.fields[2].config = __assign(__assign({}, frame.fields[2].config), { displayName: 'Indoor Temperature' });
            var suggestions = getDataFrameVars([frame]);
            expect(suggestions).toEqual([
                {
                    value: '__data.fields.time',
                    label: 'time',
                    documentation: "Formatted value for time on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: '__data.fields["Indoor Temperature"]',
                    label: 'Indoor Temperature',
                    documentation: "Formatted value for Indoor Temperature on the same row",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[0]",
                    label: "Select by index",
                    documentation: "Enter the field order",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"].numeric",
                    label: "Show numeric value",
                    documentation: "the numeric field value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"].text",
                    label: "Show text value",
                    documentation: "the text value",
                    origin: VariableOrigin.Fields,
                },
                {
                    value: "__data.fields[\"Indoor Temperature\"]",
                    label: "Select by title",
                    documentation: "Use the title to pick the field",
                    origin: VariableOrigin.Fields,
                },
            ]);
        });
    });
    describe('when called with multiple DataFrames', function () {
        it('it should not return any suggestions', function () {
            var frame1 = toDataFrame({
                name: 'server1',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'value', type: FieldType.number, values: [10, 11, 12] },
                ],
            });
            var frame2 = toDataFrame({
                name: 'server2',
                fields: [
                    { name: 'time', type: FieldType.time, values: [1, 2, 3] },
                    { name: 'value', type: FieldType.number, values: [10, 11, 12] },
                ],
            });
            var suggestions = getDataFrameVars([frame1, frame2]);
            expect(suggestions).toEqual([]);
        });
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=link_srv.test.js.map