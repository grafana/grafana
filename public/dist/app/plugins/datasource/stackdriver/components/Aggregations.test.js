import * as tslib_1 from "tslib";
import React from 'react';
import renderer from 'react-test-renderer';
import { Aggregations } from './Aggregations';
import { shallow } from 'enzyme';
import { ValueTypes, MetricKind } from '../constants';
import { TemplateSrvStub } from 'test/specs/helpers';
var props = {
    onChange: function () { },
    templateSrv: new TemplateSrvStub(),
    metricDescriptor: {
        valueType: '',
        metricKind: '',
    },
    crossSeriesReducer: '',
    groupBys: [],
    children: function (renderProps) { return React.createElement("div", null); },
};
describe('Aggregations', function () {
    var wrapper;
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(Aggregations, tslib_1.__assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
    describe('options', function () {
        describe('when DOUBLE and DELTA is passed as props', function () {
            beforeEach(function () {
                var newProps = tslib_1.__assign({}, props, { metricDescriptor: { valueType: ValueTypes.DOUBLE, metricKind: MetricKind.GAUGE } });
                wrapper = shallow(React.createElement(Aggregations, tslib_1.__assign({}, newProps)));
            });
            it('', function () {
                var options = wrapper.state().aggOptions[0].options;
                expect(options.length).toEqual(11);
                expect(options.map(function (o) { return o.value; })).toEqual(expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE']));
            });
        });
        describe('when MONEY and CUMULATIVE is passed as props', function () {
            beforeEach(function () {
                var newProps = tslib_1.__assign({}, props, { metricDescriptor: { valueType: ValueTypes.MONEY, metricKind: MetricKind.CUMULATIVE } });
                wrapper = shallow(React.createElement(Aggregations, tslib_1.__assign({}, newProps)));
            });
            it('', function () {
                var options = wrapper.state().aggOptions[0].options;
                expect(options.length).toEqual(10);
                expect(options.map(function (o) { return o.value; })).toEqual(expect.arrayContaining(['REDUCE_NONE']));
            });
        });
    });
});
//# sourceMappingURL=Aggregations.test.js.map