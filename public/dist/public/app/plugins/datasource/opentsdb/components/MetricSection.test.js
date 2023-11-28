import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MetricSection, testIds } from './MetricSection';
const onRunQuery = jest.fn();
const onChange = jest.fn();
const setup = (propOverrides) => {
    const suggestMetrics = jest.fn();
    const query = {
        metric: 'cpu',
        refId: 'A',
        aggregator: 'avg',
        alias: 'alias',
    };
    const props = {
        query,
        onChange: onChange,
        onRunQuery: onRunQuery,
        suggestMetrics: suggestMetrics,
        aggregators: ['avg'],
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(MetricSection, Object.assign({}, props)));
};
describe('MetricSection', () => {
    it('should render metrics section', () => {
        setup();
        expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('metric aggregator', () => {
        it('should render metrics select', () => {
            setup();
            expect(screen.getByText('cpu')).toBeInTheDocument();
        });
    });
    describe('metric aggregator', () => {
        it('should render the metrics aggregator', () => {
            setup();
            expect(screen.getByText('avg')).toBeInTheDocument();
        });
    });
    describe('metric alias', () => {
        it('should render the alias input', () => {
            setup();
            expect(screen.getByTestId('metric-alias')).toBeInTheDocument();
        });
        it('should fire OnRunQuery on blur', () => {
            setup();
            const alias = screen.getByTestId('metric-alias');
            fireEvent.click(alias);
            fireEvent.blur(alias);
            expect(onRunQuery).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=MetricSection.test.js.map