var _this = this;
import * as tslib_1 from "tslib";
import React from 'react';
import renderer from 'react-test-renderer';
import { StackdriverVariableQueryEditor } from './VariableQueryEditor';
import { MetricFindQueryTypes } from '../types';
jest.mock('../functions', function () { return ({
    getMetricTypes: function () { return ({ metricTypes: [], selectedMetricType: '' }); },
    extractServicesFromMetricDescriptors: function () { return []; },
}); });
var props = {
    onChange: function (query, definition) { },
    query: {},
    datasource: {
        getMetricTypes: function (p) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
            return [2 /*return*/, []];
        }); }); },
    },
    templateSrv: { replace: function (s) { return s; }, variables: [] },
};
describe('VariableQueryEditor', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(StackdriverVariableQueryEditor, tslib_1.__assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
    describe('and a new variable is created', function () {
        it('should trigger a query using the first query type in the array', function (done) {
            props.onChange = function (query, definition) {
                expect(definition).toBe('Stackdriver - Services');
                done();
            };
            renderer.create(React.createElement(StackdriverVariableQueryEditor, tslib_1.__assign({}, props))).toJSON();
        });
    });
    describe('and an existing variable is edited', function () {
        it('should trigger new query using the saved query type', function (done) {
            props.query = { selectedQueryType: MetricFindQueryTypes.LabelKeys };
            props.onChange = function (query, definition) {
                expect(definition).toBe('Stackdriver - Label Keys');
                done();
            };
            renderer.create(React.createElement(StackdriverVariableQueryEditor, tslib_1.__assign({}, props))).toJSON();
        });
    });
});
//# sourceMappingURL=VariableQueryEditor.test.js.map