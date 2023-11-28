import { render, screen } from '@testing-library/react';
import React from 'react';
import { openMenu } from 'react-select-event';
import { TemplateSrvStub } from 'test/specs/helpers';
import { MetricKind, ValueTypes } from '../types/query';
import { Aggregation } from './Aggregation';
const props = {
    onChange: () => { },
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
describe('Aggregation', () => {
    it('renders correctly', () => {
        render(React.createElement(Aggregation, Object.assign({}, props)));
        expect(screen.getByTestId('cloud-monitoring-aggregation')).toBeInTheDocument();
    });
    describe('options', () => {
        describe('when DOUBLE and GAUGE is passed as props', () => {
            const nextProps = Object.assign(Object.assign({}, props), { metricDescriptor: {
                    valueType: ValueTypes.DOUBLE,
                    metricKind: MetricKind.GAUGE,
                } });
            it('should not have the reduce values', () => {
                render(React.createElement(Aggregation, Object.assign({}, nextProps)));
                const label = screen.getByLabelText('Group by function');
                openMenu(label);
                expect(screen.queryByText('count true')).not.toBeInTheDocument();
                expect(screen.queryByText('count false')).not.toBeInTheDocument();
            });
        });
        describe('when MONEY and CUMULATIVE is passed as props', () => {
            const nextProps = Object.assign(Object.assign({}, props), { metricDescriptor: {
                    valueType: ValueTypes.MONEY,
                    metricKind: MetricKind.CUMULATIVE,
                } });
            it('should have the reduce values', () => {
                render(React.createElement(Aggregation, Object.assign({}, nextProps)));
                const label = screen.getByLabelText('Group by function');
                openMenu(label);
                expect(screen.getByText('none')).toBeInTheDocument();
            });
        });
    });
});
//# sourceMappingURL=Aggregation.test.js.map