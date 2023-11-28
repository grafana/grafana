import { __awaiter } from "tslib";
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { from } from 'rxjs';
import { getDefaultTimeRange } from '@grafana/data';
import { defaultBucketAgg } from '../../../queryDef';
import { ElasticsearchProvider } from '../ElasticsearchQueryContext';
import { MetricEditor } from './MetricEditor';
describe('Metric Editor', () => {
    it('Should display a "None" option for "field" if the metric supports inline script', () => __awaiter(void 0, void 0, void 0, function* () {
        const avg = {
            id: '1',
            type: 'avg',
        };
        const query = {
            refId: 'A',
            query: '',
            metrics: [avg],
            bucketAggs: [defaultBucketAgg('2')],
        };
        const getFields = jest.fn(() => from([[]]));
        const wrapper = ({ children }) => (React.createElement(ElasticsearchProvider, { datasource: { getFields }, query: query, range: getDefaultTimeRange(), onChange: () => { }, onRunQuery: () => { } }, children));
        render(React.createElement(MetricEditor, { value: avg }), { wrapper });
        act(() => {
            fireEvent.click(screen.getByText('Select Field'));
        });
        expect(yield screen.findByText('None')).toBeInTheDocument();
    }));
    it('Should not display a "None" option for "field" if the metric does not support inline script', () => __awaiter(void 0, void 0, void 0, function* () {
        const avg = {
            id: '1',
            type: 'cardinality',
        };
        const query = {
            refId: 'A',
            query: '',
            metrics: [avg],
            bucketAggs: [defaultBucketAgg('2')],
        };
        const getFields = jest.fn(() => from([[]]));
        const wrapper = ({ children }) => (React.createElement(ElasticsearchProvider, { datasource: { getFields }, query: query, range: getDefaultTimeRange(), onChange: () => { }, onRunQuery: () => { } }, children));
        render(React.createElement(MetricEditor, { value: avg }), { wrapper });
        act(() => {
            fireEvent.click(screen.getByText('Select Field'));
        });
        expect(yield screen.findByText('No options found')).toBeInTheDocument();
        expect(screen.queryByText('None')).not.toBeInTheDocument();
    }));
    it('Should not list special metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        const count = {
            id: '1',
            type: 'count',
        };
        const query = {
            refId: 'A',
            query: '',
            metrics: [count],
            bucketAggs: [],
        };
        const getDatabaseVersion = jest.fn(() => Promise.resolve(null));
        const wrapper = ({ children }) => (React.createElement(ElasticsearchProvider, { datasource: { getDatabaseVersion }, query: query, range: getDefaultTimeRange(), onChange: () => { }, onRunQuery: () => { } }, children));
        render(React.createElement(MetricEditor, { value: count }), { wrapper });
        act(() => {
            userEvent.click(screen.getByText('Count'));
        });
        // we check if the list-of-options is visible by
        // checking for an item to exist
        expect(yield screen.findByText('Extended Stats')).toBeInTheDocument();
        // now we make sure the should-not-be-shown items are not shown
        expect(screen.queryByText('Logs')).toBeNull();
        expect(screen.queryByText('Raw Data')).toBeNull();
        expect(screen.queryByText('Raw Document (deprecated)')).toBeNull();
    }));
});
//# sourceMappingURL=MetricEditor.test.js.map