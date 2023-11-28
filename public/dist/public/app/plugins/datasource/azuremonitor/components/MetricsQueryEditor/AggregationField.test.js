import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import AggregationField from './AggregationField';
const props = {
    aggregationOptions: [],
    query: createMockQuery(),
    datasource: createMockDatasource(),
    variableOptionGroup: { label: 'Templates', options: [] },
    onQueryChange: jest.fn(),
    setError: jest.fn(),
    isLoading: false,
};
describe('AggregationField', () => {
    it('should render the current value', () => __awaiter(void 0, void 0, void 0, function* () {
        const aggregationOptions = [{ label: 'foo', value: 'foo' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                aggregation: 'foo',
            } });
        render(React.createElement(AggregationField, Object.assign({}, props, { aggregationOptions: aggregationOptions, query: query })));
        expect(screen.queryByText('foo')).toBeInTheDocument();
    }));
    it('should render the current value even if it is not in the list of options', () => __awaiter(void 0, void 0, void 0, function* () {
        const aggregationOptions = [{ label: 'foo', value: 'foo' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                aggregation: 'bar',
            } });
        render(React.createElement(AggregationField, Object.assign({}, props, { aggregationOptions: aggregationOptions, query: query })));
        expect(screen.queryByText('bar')).toBeInTheDocument();
        expect(screen.queryByText('foo')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=AggregationField.test.js.map