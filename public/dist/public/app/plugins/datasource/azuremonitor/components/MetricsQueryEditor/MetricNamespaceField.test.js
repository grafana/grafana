import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';
import MetricNamespaceField from './MetricNamespaceField';
const props = {
    metricNamespaces: [],
    query: createMockQuery(),
    datasource: createMockDatasource(),
    variableOptionGroup: { label: 'Templates', options: [] },
    onQueryChange: jest.fn(),
    setError: jest.fn(),
};
describe('Azure Monitor QueryEditor', () => {
    it('should render the current value', () => __awaiter(void 0, void 0, void 0, function* () {
        const metricNamespaces = [{ label: 'foo', value: 'foo' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                metricNamespace: 'foo',
            } });
        render(React.createElement(MetricNamespaceField, Object.assign({}, props, { metricNamespaces: metricNamespaces, query: query })));
        expect(screen.queryByText('foo')).toBeInTheDocument();
    }));
    it('should render the current value even if it is not in the list of options', () => __awaiter(void 0, void 0, void 0, function* () {
        const metricNamespaces = [{ label: 'foo', value: 'foo' }];
        const query = Object.assign(Object.assign({}, props.query), { azureMonitor: {
                metricNamespace: 'bar',
            } });
        render(React.createElement(MetricNamespaceField, Object.assign({}, props, { metricNamespaces: metricNamespaces, query: query })));
        expect(screen.queryByText('bar')).toBeInTheDocument();
        expect(screen.queryByText('foo')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=MetricNamespaceField.test.js.map