import { __awaiter } from "tslib";
import { render, screen, getAllByRole, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getSelectParent } from 'test/helpers/selectOptionInTest';
import { MISSING_LABEL_FILTER_ERROR_MESSAGE } from '../../../prometheus/querybuilder/shared/LabelFilters';
import { LokiDatasource } from '../../datasource';
import { LokiOperationId } from '../types';
import { LokiQueryBuilder } from './LokiQueryBuilder';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
const defaultQuery = {
    labels: [{ op: '=', label: 'baz', value: 'bar' }],
    operations: [],
};
const createDefaultProps = () => {
    const datasource = new LokiDatasource({
        url: '',
        jsonData: {},
        meta: {},
    }, undefined, undefined);
    const props = {
        datasource,
        onRunQuery: () => { },
        onChange: () => { },
        showExplain: false,
    };
    return props;
};
describe('LokiQueryBuilder', () => {
    it('tries to load labels when no labels are selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createDefaultProps();
        props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
        props.datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });
        render(React.createElement(LokiQueryBuilder, Object.assign({}, props, { query: defaultQuery })));
        yield userEvent.click(screen.getByLabelText('Add'));
        const labels = screen.getByText(/Label filters/);
        const selects = getAllByRole(getSelectParent(labels), 'combobox');
        yield userEvent.click(selects[3]);
        yield waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
    }));
    it('does not show already existing label names as option in label filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createDefaultProps();
        props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
        props.datasource.languageProvider.fetchSeriesLabels = jest
            .fn()
            .mockReturnValue({ job: ['a'], instance: ['b'], baz: ['bar'] });
        render(React.createElement(LokiQueryBuilder, Object.assign({}, props, { query: defaultQuery })));
        yield userEvent.click(screen.getByLabelText('Add'));
        const labels = screen.getByText(/Label filters/);
        const selects = getAllByRole(getSelectParent(labels), 'combobox');
        yield userEvent.click(selects[3]);
        yield waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('instance')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getAllByText('baz')).toHaveLength(1));
    }));
    it('shows error for query with operations and no stream selector', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = { labels: [], operations: [{ id: LokiOperationId.Logfmt, params: [] }] };
        render(React.createElement(LokiQueryBuilder, Object.assign({}, createDefaultProps(), { query: query })));
        expect(yield screen.findByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
    }));
    it('shows no error for query with empty __line_contains operation and no stream selector', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = { labels: [], operations: [{ id: LokiOperationId.LineContains, params: [''] }] };
        render(React.createElement(LokiQueryBuilder, Object.assign({}, createDefaultProps(), { query: query })));
        yield waitFor(() => {
            expect(screen.queryByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).not.toBeInTheDocument();
        });
    }));
    it('shows explain section when showExplain is true', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = {
            labels: [{ label: 'foo', op: '=', value: 'bar' }],
            operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
        };
        const props = createDefaultProps();
        props.showExplain = true;
        props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
        render(React.createElement(LokiQueryBuilder, Object.assign({}, props, { query: query })));
        expect(yield screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('does not shows explain section when showExplain is false', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = {
            labels: [{ label: 'foo', op: '=', value: 'bar' }],
            operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
        };
        const props = createDefaultProps();
        props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
        render(React.createElement(LokiQueryBuilder, Object.assign({}, props, { query: query })));
        yield waitFor(() => {
            expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=LokiQueryBuilder.test.js.map