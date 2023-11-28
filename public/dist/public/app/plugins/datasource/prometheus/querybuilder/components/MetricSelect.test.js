import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { formatPrometheusLabelFilters, formatPrometheusLabelFiltersToString, MetricSelect, } from './MetricSelect';
const instanceSettings = {
    url: 'proxied',
    id: 1,
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'GET' },
};
const dataSourceMock = new PrometheusDatasource(instanceSettings);
const mockValues = [{ label: 'random_metric' }, { label: 'unique_metric' }, { label: 'more_unique_metric' }];
// Mock metricFindQuery which will call backend API
//@ts-ignore
dataSourceMock.metricFindQuery = jest.fn((query) => {
    // Use the label values regex to get the values inside the label_values function call
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;
    const queryValueArray = query.match(labelValuesRegex);
    const queryValueRaw = queryValueArray[1];
    // Remove the wrapping regex
    const queryValue = queryValueRaw.substring(queryValueRaw.indexOf('".*') + 3, queryValueRaw.indexOf('.*"'));
    // Run the regex that we'd pass into prometheus API against the strings in the test
    return Promise.resolve(mockValues
        .filter((value) => value.label.match(queryValue))
        .map((result) => {
        return {
            text: result.label,
        };
    }));
});
const props = {
    labelsFilters: [],
    datasource: dataSourceMock,
    query: {
        metric: '',
        labels: [],
        operations: [],
    },
    onChange: jest.fn(),
    onGetMetrics: jest.fn().mockResolvedValue(mockValues),
    metricLookupDisabled: false,
};
describe('MetricSelect', () => {
    it('shows all metric options', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        yield waitFor(() => expect(screen.getByText('random_metric')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('unique_metric')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('more_unique_metric')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
    }));
    it('truncates list of metrics to 1000', () => __awaiter(void 0, void 0, void 0, function* () {
        const manyMockValues = [...Array(1001).keys()].map((idx) => {
            return { label: 'random_metric' + idx };
        });
        props.onGetMetrics = jest.fn().mockResolvedValue(manyMockValues);
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        yield waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(1000));
    }));
    it('shows option to set custom value when typing', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'custom value');
        yield waitFor(() => expect(screen.getByText('custom value')).toBeInTheDocument());
    }));
    it('shows searched options when typing', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'unique');
        yield waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(3));
    }));
    it('searches on split words', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'more unique');
        yield waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
    }));
    it('searches on multiple split words', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'more unique metric');
        yield waitFor(() => expect(screen.getAllByLabelText('Select option')).toHaveLength(2));
    }));
    it('highlights matching string', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'more');
        yield waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(1));
    }));
    it('highlights multiple matching strings in 1 input row', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'more metric');
        yield waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(2));
    }));
    it('highlights multiple matching strings in multiple input rows', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'unique metric');
        yield waitFor(() => expect(document.querySelectorAll('mark')).toHaveLength(4));
    }));
    it('does not highlight matching string in create option', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        yield openMetricSelect();
        const input = screen.getByRole('combobox');
        yield userEvent.type(input, 'new');
        yield waitFor(() => expect(document.querySelector('mark')).not.toBeInTheDocument());
    }));
    it('label filters properly join', () => {
        const query = formatPrometheusLabelFilters([
            {
                value: 'value',
                label: 'label',
                op: '=',
            },
            {
                value: 'value2',
                label: 'label2',
                op: '=',
            },
        ]);
        query.forEach((label) => {
            expect(label.includes(',', 0));
        });
    });
    it('label filter creation', () => {
        const labels = [
            {
                value: 'value',
                label: 'label',
                op: '=',
            },
            {
                value: 'value2',
                label: 'label2',
                op: '=',
            },
        ];
        const queryString = formatPrometheusLabelFiltersToString('query', labels);
        queryString.split(',').forEach((queryChunk) => {
            expect(queryChunk.length).toBeGreaterThan(1); // must be longer then ','
        });
    });
});
function openMetricSelect() {
    return __awaiter(this, void 0, void 0, function* () {
        const select = screen.getByText('Select metric').parentElement;
        yield userEvent.click(select);
    });
}
//# sourceMappingURL=MetricSelect.test.js.map