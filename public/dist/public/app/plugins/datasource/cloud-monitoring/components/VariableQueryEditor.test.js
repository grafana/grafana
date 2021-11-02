import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { CloudMonitoringVariableQueryEditor } from './VariableQueryEditor';
import { MetricFindQueryTypes } from '../types';
jest.mock('../functions', function () { return ({
    getMetricTypes: function () { return ({ metricTypes: [], selectedMetricType: '' }); },
    extractServicesFromMetricDescriptors: function () { return []; },
}); });
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getTemplateSrv: function () { return ({
            replace: function (s) { return s; },
            getVariables: function () { return []; },
        }); } });
});
var props = {
    onChange: function (query) { },
    query: {},
    datasource: {
        getDefaultProject: function () { return ''; },
        getProjects: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, Promise.resolve([])];
        }); }); },
        getMetricTypes: function (projectName) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, Promise.resolve([])];
        }); }); },
        getSLOServices: function (projectName) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, Promise.resolve([])];
        }); }); },
        getServiceLevelObjectives: function (projectName, serviceId) { return Promise.resolve([]); },
    },
    onRunQuery: function () { },
};
describe('VariableQueryEditor', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, __assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
    describe('and a new variable is created', function () {
        it('should trigger a query using the first query type in the array', function (done) {
            props.onChange = function (query) {
                expect(query.selectedQueryType).toBe('projects');
                done();
            };
            renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, __assign({}, props))).toJSON();
        });
    });
    describe('and an existing variable is edited', function () {
        it('should trigger new query using the saved query type', function (done) {
            props.query = { selectedQueryType: MetricFindQueryTypes.LabelKeys };
            props.onChange = function (query) {
                expect(query.selectedQueryType).toBe('labelKeys');
                done();
            };
            renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, __assign({}, props))).toJSON();
        });
    });
});
//# sourceMappingURL=VariableQueryEditor.test.js.map