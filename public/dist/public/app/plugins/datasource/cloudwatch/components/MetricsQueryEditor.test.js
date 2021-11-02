import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { MetricsQueryEditor, normalizeQuery } from './MetricsQueryEditor';
import { CloudWatchDatasource } from '../datasource';
import { initialVariableModelState } from '../../../../features/variables/types';
var setup = function () {
    var instanceSettings = {
        jsonData: { defaultRegion: 'us-east-1' },
    };
    var templateSrv = new TemplateSrv();
    var variable = __assign(__assign({}, initialVariableModelState), { id: 'var3', index: 0, name: 'var3', options: [
            { selected: true, value: 'var3-foo', text: 'var3-foo' },
            { selected: false, value: 'var3-bar', text: 'var3-bar' },
            { selected: true, value: 'var3-baz', text: 'var3-baz' },
        ], current: { selected: true, value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz' }, multi: true, includeAll: false, query: '', type: 'custom' });
    templateSrv.init([variable]);
    var datasource = new CloudWatchDatasource(instanceSettings, templateSrv, {});
    datasource.metricFindQuery = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, [{ value: 'test', label: 'test', text: 'test' }]];
    }); }); };
    var props = {
        query: {
            queryMode: 'Metrics',
            refId: '',
            id: '',
            region: 'us-east-1',
            namespace: 'ec2',
            metricName: 'CPUUtilization',
            dimensions: { somekey: 'somevalue' },
            statistic: '',
            period: '',
            expression: '',
            alias: '',
            matchExact: true,
        },
        datasource: datasource,
        history: [],
        onChange: jest.fn(),
        onRunQuery: jest.fn(),
    };
    return props;
};
describe('QueryEditor', function () {
    it('should render component', function () { return __awaiter(void 0, void 0, void 0, function () {
        var act;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    act = renderer.act;
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var props, tree;
                            return __generator(this, function (_a) {
                                props = setup();
                                tree = renderer.create(React.createElement(MetricsQueryEditor, __assign({}, props))).toJSON();
                                expect(tree).toMatchSnapshot();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it('normalizes query on mount', function () { return __awaiter(void 0, void 0, void 0, function () {
        var act, props;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    act = renderer.act;
                    props = setup();
                    // This does not actually even conform to the prop type but this happens on initialisation somehow
                    props.query = {
                        queryMode: 'Metrics',
                        apiMode: 'Metrics',
                        refId: '',
                        expression: '',
                        matchExact: true,
                    };
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                renderer.create(React.createElement(MetricsQueryEditor, __assign({}, props)));
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(props.onChange.mock.calls[0][0]).toEqual({
                        namespace: '',
                        metricName: '',
                        expression: '',
                        dimensions: {},
                        region: 'default',
                        id: '',
                        alias: '',
                        statistic: 'Average',
                        period: '',
                        queryMode: 'Metrics',
                        apiMode: 'Metrics',
                        refId: '',
                        matchExact: true,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    describe('should use correct default values', function () {
        it('when region is null is display default in the label', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // @ts-ignore strict null error TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            var props, wrapper;
                            return __generator(this, function (_a) {
                                props = setup();
                                props.query.region = null;
                                wrapper = mount(React.createElement(MetricsQueryEditor, __assign({}, props)));
                                expect(wrapper.find('.gf-form-inline').first().find('Segment').find('InlineLabel').find('label').text()).toEqual('default');
                                return [2 /*return*/];
                            });
                        }); })];
                    case 1:
                        // @ts-ignore strict null error TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should normalize query with default values', function () {
            expect(normalizeQuery({ refId: '42' })).toEqual({
                namespace: '',
                metricName: '',
                expression: '',
                dimensions: {},
                region: 'default',
                id: '',
                alias: '',
                statistic: 'Average',
                matchExact: true,
                period: '',
                refId: '42',
            });
        });
    });
});
//# sourceMappingURL=MetricsQueryEditor.test.js.map