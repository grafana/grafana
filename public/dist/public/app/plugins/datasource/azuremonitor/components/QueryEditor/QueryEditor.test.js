import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import createMockDatasource from '../../__mocks__/datasource';
import { invalidNamespaceError } from '../../__mocks__/errors';
import createMockQuery from '../../__mocks__/query';
import { selectors } from '../../e2e/selectors';
import { AzureQueryType } from '../../types';
import QueryEditor from './QueryEditor';
// Have to mock CodeEditor because it doesnt seem to work in tests???
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor({ value }) {
        return React.createElement("pre", null, value);
    } })));
describe('Azure Monitor QueryEditor', () => {
    it('renders the Metrics query editor when the query type is Metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = Object.assign(Object.assign({}, createMockQuery()), { queryType: AzureQueryType.AzureMonitor });
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.getByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)).toBeInTheDocument());
    }));
    it('renders the Logs query editor when the query type is Logs', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = Object.assign(Object.assign({}, createMockQuery()), { queryType: AzureQueryType.LogAnalytics });
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.queryByTestId(selectors.components.queryEditor.logsQueryEditor.container.input)).toBeInTheDocument());
    }));
    it('renders the ARG query editor when the query type is ARG', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = Object.assign(Object.assign({}, createMockQuery()), { queryType: AzureQueryType.AzureResourceGraph });
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.queryByTestId(selectors.components.queryEditor.argsQueryEditor.container.input)).toBeInTheDocument());
    }));
    it('renders the Traces query editor when the query type is Traces', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = Object.assign(Object.assign({}, createMockQuery()), { queryType: AzureQueryType.AzureTraces });
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.queryByTestId(selectors.components.queryEditor.tracesQueryEditor.container.input)).toBeInTheDocument());
    }));
    it('changes the query type when selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = createMockQuery();
        const onChange = jest.fn();
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: onChange, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.getByTestId('azure-monitor-query-editor')).toBeInTheDocument());
        const metrics = yield screen.findByLabelText(/Service/);
        yield selectOptionInTest(metrics, 'Logs');
        expect(onChange).toHaveBeenCalledWith({
            refId: mockQuery.refId,
            datasource: mockQuery.datasource,
            queryType: AzureQueryType.LogAnalytics,
        });
    }));
    it('displays error messages from frontend Azure calls', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest.fn().mockRejectedValue(invalidNamespaceError());
        render(React.createElement(QueryEditor, { query: createMockQuery(), datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.getByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)).toBeInTheDocument());
        expect(screen.getByText('An error occurred while requesting metadata from Azure Monitor')).toBeInTheDocument();
    }));
    it('should render the experimental QueryHeader when feature toggle is enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = createMockDatasource();
        const mockQuery = Object.assign(Object.assign({}, createMockQuery()), { queryType: AzureQueryType.AzureMonitor });
        render(React.createElement(QueryEditor, { query: mockQuery, datasource: mockDatasource, onChange: () => { }, onRunQuery: () => { } }));
        yield waitFor(() => expect(screen.getByTestId('data-testid azure-monitor-experimental-header')).toBeInTheDocument());
    }));
});
//# sourceMappingURL=QueryEditor.test.js.map