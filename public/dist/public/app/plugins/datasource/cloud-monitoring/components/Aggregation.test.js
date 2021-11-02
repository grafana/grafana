import { __assign, __read } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { shallow } from 'enzyme';
import { Select } from '@grafana/ui';
import { Aggregation } from './Aggregation';
import { ValueTypes, MetricKind } from '../types';
import { TemplateSrvStub } from 'test/specs/helpers';
var props = {
    onChange: function () { },
    // @ts-ignore
    templateSrv: new TemplateSrvStub(),
    metricDescriptor: {
        valueType: '',
        metricKind: '',
    },
    crossSeriesReducer: '',
    groupBys: [],
    templateVariableOptions: [],
};
describe('Aggregation', function () {
    it('renders correctly', function () {
        render(React.createElement(Aggregation, __assign({}, props)));
        expect(screen.getByTestId('cloud-monitoring-aggregation')).toBeInTheDocument();
    });
    describe('options', function () {
        describe('when DOUBLE and GAUGE is passed as props', function () {
            var nextProps = __assign(__assign({}, props), { metricDescriptor: {
                    valueType: ValueTypes.DOUBLE,
                    metricKind: MetricKind.GAUGE,
                } });
            it('should not have the reduce values', function () {
                var wrapper = shallow(React.createElement(Aggregation, __assign({}, nextProps)));
                var options = wrapper.find(Select).props().options;
                var _a = __read(options, 2), aggGroup = _a[1];
                expect(aggGroup.options.length).toEqual(11);
                expect(aggGroup.options.map(function (o) { return o.value; })).toEqual(expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE']));
            });
        });
        describe('when MONEY and CUMULATIVE is passed as props', function () {
            var nextProps = __assign(__assign({}, props), { metricDescriptor: {
                    valueType: ValueTypes.MONEY,
                    metricKind: MetricKind.CUMULATIVE,
                } });
            it('should have the reduce values', function () {
                var wrapper = shallow(React.createElement(Aggregation, __assign({}, nextProps)));
                var options = wrapper.find(Select).props().options;
                var _a = __read(options, 2), aggGroup = _a[1];
                expect(aggGroup.options.length).toEqual(11);
                expect(aggGroup.options.map(function (o) { return o.value; })).toEqual(expect.arrayContaining(['REDUCE_NONE']));
            });
        });
    });
});
//# sourceMappingURL=Aggregation.test.js.map