import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import TimeGrainField from './TimeGrainField';
const props = {
    timeGrainOptions: [],
    query: createMockQuery(),
    datasource: createMockDatasource(),
    variableOptionGroup: { label: 'Templates', options: [] },
    onQueryChange: jest.fn(),
    setError: jest.fn(),
    isLoading: false,
};
describe('TimeGrainField', () => {
    it('should render the current value', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeGrainOptions = [{ label: '15m', value: '15m' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                timeGrain: '15m',
            } });
        render(React.createElement(TimeGrainField, Object.assign({}, props, { timeGrainOptions: timeGrainOptions, query: query })));
        expect(screen.queryByText('15m')).toBeInTheDocument();
    }));
    it('should render the current value even if it is not in the list of options', () => __awaiter(void 0, void 0, void 0, function* () {
        const timeGrainOptions = [{ label: '15m', value: '15m' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                timeGrain: '1h',
            } });
        render(React.createElement(TimeGrainField, Object.assign({}, props, { timeGrainOptions: timeGrainOptions, query: query })));
        expect(screen.queryByText('1h')).toBeInTheDocument();
        expect(screen.queryByText('15m')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=TimeGrainField.test.js.map