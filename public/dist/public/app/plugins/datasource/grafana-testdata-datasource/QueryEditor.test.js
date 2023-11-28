import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryEditor } from './QueryEditor';
import { scenarios } from './__mocks__/scenarios';
import { defaultQuery } from './constants';
import { TestDataQueryType } from './dataquery.gen';
import { defaultStreamQuery } from './runStreams';
beforeEach(() => {
    jest.clearAllMocks();
});
const mockOnChange = jest.fn();
const props = {
    onRunQuery: jest.fn(),
    query: defaultQuery,
    onChange: mockOnChange,
    datasource: {
        getScenarios: () => Promise.resolve(scenarios),
    },
};
const setup = (testProps) => {
    const editorProps = Object.assign(Object.assign({}, props), testProps);
    return render(React.createElement(QueryEditor, Object.assign({}, editorProps)));
};
describe('Test Datasource Query Editor', () => {
    it('should render with default scenario', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByText(/random walk/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Alias' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Labels' })).toBeInTheDocument();
    }));
    it('should switch scenario and display its default values', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = setup();
        let select = (yield screen.findByText('Scenario')).nextSibling.firstChild;
        yield fireEvent.keyDown(select, { keyCode: 40 });
        const scs = screen.getAllByLabelText('Select option');
        expect(scs).toHaveLength(scenarios.length);
        yield userEvent.click(screen.getByText('CSV Metric Values'));
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: TestDataQueryType.CSVMetricValues }));
        yield rerender(React.createElement(QueryEditor, Object.assign({}, props, { query: Object.assign(Object.assign({}, defaultQuery), { scenarioId: TestDataQueryType.CSVMetricValues, stringInput: '1,20,90,30,5,0' }) })));
        expect(yield screen.findByRole('textbox', { name: /string input/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /string input/i })).toHaveValue('1,20,90,30,5,0');
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield userEvent.click(screen.getByText('Grafana API'));
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'grafana_api', stringInput: 'datasources' }));
        rerender(React.createElement(QueryEditor, Object.assign({}, props, { query: Object.assign(Object.assign({}, defaultQuery), { scenarioId: TestDataQueryType.GrafanaAPI, stringInput: 'datasources' }) })));
        expect(yield screen.findByText('Grafana API')).toBeInTheDocument();
        expect(screen.getByText('Data Sources')).toBeInTheDocument();
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield userEvent.click(screen.getByText('Streaming Client'));
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ scenarioId: 'streaming_client', stream: defaultStreamQuery }));
        const streamQuery = Object.assign(Object.assign({}, defaultQuery), { stream: defaultStreamQuery, scenarioId: TestDataQueryType.StreamingClient });
        rerender(React.createElement(QueryEditor, Object.assign({}, props, { query: streamQuery })));
        expect(yield screen.findByText('Streaming Client')).toBeInTheDocument();
        expect(screen.getByText('Type')).toBeInTheDocument();
        expect(screen.getByLabelText('Noise')).toHaveValue(2.2);
        expect(screen.getByLabelText('Speed (ms)')).toHaveValue(250);
        expect(screen.getByLabelText('Spread')).toHaveValue(3.5);
        expect(screen.getByLabelText('Bands')).toHaveValue(1);
    }));
    it('persists the datasource from the query when switching scenario', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDatasource = {
            type: 'test',
            uid: 'foo',
        };
        setup({
            query: Object.assign(Object.assign({}, defaultQuery), { datasource: mockDatasource }),
        });
        let select = (yield screen.findByText('Scenario')).nextSibling.firstChild;
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield userEvent.click(screen.getByText('Grafana API'));
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ datasource: mockDatasource }));
    }));
});
//# sourceMappingURL=QueryEditor.test.js.map