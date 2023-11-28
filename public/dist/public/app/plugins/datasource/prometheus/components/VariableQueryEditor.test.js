import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { migrateVariableEditorBackToVariableSupport } from '../migrations/variableMigration';
import { PromVariableQueryType } from '../types';
import { PromVariableQueryEditor, variableMigration } from './VariableQueryEditor';
const refId = 'PrometheusVariableQueryEditor-VariableQuery';
describe('PromVariableQueryEditor', () => {
    let props;
    test('Migrates from standard variable support to custom variable query', () => {
        const query = {
            query: 'label_names()',
            refId: 'StandardVariableQuery',
        };
        const migration = variableMigration(query);
        const expected = {
            qryType: PromVariableQueryType.LabelNames,
            refId: 'PrometheusDatasource-VariableQuery',
        };
        expect(migration).toEqual(expected);
    });
    test('Allows for use of variables to interpolate label names in the label values query type.', () => {
        const query = {
            query: 'label_values($label_name)',
            refId: 'StandardVariableQuery',
        };
        const migration = variableMigration(query);
        const expected = {
            qryType: PromVariableQueryType.LabelValues,
            label: '$label_name',
            refId: 'PrometheusDatasource-VariableQuery',
        };
        expect(migration).toEqual(expected);
    });
    test('Migrates from jsonnet grafana as code variable to custom variable query', () => {
        const query = 'label_names()';
        const migration = variableMigration(query);
        const expected = {
            qryType: PromVariableQueryType.LabelNames,
            refId: 'PrometheusDatasource-VariableQuery',
        };
        expect(migration).toEqual(expected);
    });
    test('Migrates label filters to the query object for label_values()', () => {
        const query = {
            query: 'label_values(metric{label="value"},name)',
            refId: 'StandardVariableQuery',
        };
        const migration = variableMigration(query);
        const expected = {
            qryType: PromVariableQueryType.LabelValues,
            label: 'name',
            metric: 'metric',
            labelFilters: [
                {
                    label: 'label',
                    op: '=',
                    value: 'value',
                },
            ],
            refId: 'PrometheusDatasource-VariableQuery',
        };
        expect(migration).toEqual(expected);
    });
    test('Migrates a query object with label filters to an expression correctly', () => {
        const query = {
            qryType: PromVariableQueryType.LabelValues,
            label: 'name',
            metric: 'metric',
            labelFilters: [
                {
                    label: 'label',
                    op: '=',
                    value: 'value',
                },
            ],
            refId: 'PrometheusDatasource-VariableQuery',
        };
        const migration = migrateVariableEditorBackToVariableSupport(query);
        const expected = 'label_values(metric{label="value"},name)';
        expect(migration).toEqual(expected);
    });
    test('Migrates a query object with no metric and only label filters to an expression correctly', () => {
        const query = {
            qryType: PromVariableQueryType.LabelValues,
            label: 'name',
            labelFilters: [
                {
                    label: 'label',
                    op: '=',
                    value: 'value',
                },
            ],
            refId: 'PrometheusDatasource-VariableQuery',
        };
        const migration = migrateVariableEditorBackToVariableSupport(query);
        const expected = 'label_values({label="value"},name)';
        expect(migration).toEqual(expected);
    });
    beforeEach(() => {
        props = {
            datasource: {
                hasLabelsMatchAPISupport: () => true,
                languageProvider: {
                    start: () => Promise.resolve([]),
                    syntax: () => { },
                    getLabelKeys: () => [],
                    metrics: [],
                    metricsMetadata: {},
                    getLabelValues: jest.fn().mockImplementation(() => ['that']),
                    fetchSeriesLabelsMatch: jest.fn().mockImplementation(() => Promise.resolve({ those: 'those' })),
                },
                getInitHints: () => [],
                getDebounceTimeInMilliseconds: jest.fn(),
                getTagKeys: jest.fn().mockImplementation(() => Promise.resolve(['this'])),
                getVariables: jest.fn().mockImplementation(() => []),
                metricFindQuery: jest.fn().mockImplementation(() => Promise.resolve(['that'])),
                getSeriesLabels: jest.fn().mockImplementation(() => Promise.resolve(['that'])),
            },
            query: {
                refId: 'test',
                query: 'label_names()',
            },
            onRunQuery: () => { },
            onChange: () => { },
            history: [],
        };
    });
    test('Displays a group of function options', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props)));
        const select = screen.getByLabelText('Query type').parentElement;
        yield userEvent.click(select);
        yield waitFor(() => expect(screen.getAllByText('Label names')).toHaveLength(2));
        yield waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('Query result')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('Series query')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('Classic query')).toBeInTheDocument());
    }));
    test('Calls onChange for label_names(match) query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: '',
            match: 'that',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');
        expect(onChange).toHaveBeenCalledWith({
            query: 'label_names(that)',
            refId,
            qryType: 0,
        });
    }));
    test('Calls onChange for label_names, label_values, metrics, query result and and classic query.', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: '',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Metrics');
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Query result');
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Classic query');
        expect(onChange).toHaveBeenCalledTimes(5);
    }));
    test('Does not call onChange for series query', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Series query');
        expect(onChange).not.toHaveBeenCalled();
    }));
    test('Calls onChange for metrics() after input', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: 'label_names()',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Metrics');
        const metricInput = screen.getByLabelText('Metric selector');
        yield userEvent.type(metricInput, 'a').then((prom) => {
            const queryType = screen.getByLabelText('Query type');
            // click elsewhere to trigger the onBlur
            return userEvent.click(queryType);
        });
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith({
            query: 'metrics(a)',
            refId,
            qryType: 2,
        }));
    }));
    test('Calls onChange for label_values() after selecting label', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: 'label_names()',
            qryType: 0,
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        const labelSelect = screen.getByLabelText('label-select');
        yield userEvent.type(labelSelect, 'this');
        yield selectOptionInTest(labelSelect, 'this');
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith({
            query: 'label_values(this)',
            refId,
            qryType: 1,
        }));
    }));
    test('Calls onChange for label_values() after selecting metric', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: 'label_names()',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        const labelSelect = screen.getByLabelText('label-select');
        yield userEvent.type(labelSelect, 'this');
        yield selectOptionInTest(labelSelect, 'this');
        const metricSelect = screen.getByLabelText('Metric');
        yield userEvent.type(metricSelect, 'that');
        yield selectOptionInTest(metricSelect, 'that');
        yield waitFor(() => expect(onChange).toHaveBeenCalledWith({
            query: 'label_values(that,this)',
            refId,
            qryType: 1,
        }));
    }));
    test('Calls onChange for query_result() with argument onBlur', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: 'query_result(a)',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        const labelSelect = screen.getByLabelText('Prometheus Query');
        yield userEvent.click(labelSelect);
        const functionSelect = screen.getByLabelText('Query type').parentElement;
        yield userEvent.click(functionSelect);
        expect(onChange).toHaveBeenCalledWith({
            query: 'query_result(a)',
            refId,
            qryType: 3,
        });
    }));
    test('Calls onChange for Match[] series with argument onBlur', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            query: '{a: "example"}',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        const labelSelect = screen.getByLabelText('Series Query');
        yield userEvent.click(labelSelect);
        const functionSelect = screen.getByLabelText('Query type').parentElement;
        yield userEvent.click(functionSelect);
        expect(onChange).toHaveBeenCalledWith({
            query: '{a: "example"}',
            refId,
            qryType: 4,
        });
    }));
    test('Calls onChange for classic query onBlur', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        props.query = {
            refId: 'test',
            qryType: 5,
            query: 'label_values(instance)',
        };
        render(React.createElement(PromVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        const labelSelect = screen.getByLabelText('Classic Query');
        yield userEvent.click(labelSelect);
        const functionSelect = screen.getByLabelText('Query type').parentElement;
        yield userEvent.click(functionSelect);
        expect(onChange).toHaveBeenCalledWith({
            query: 'label_values(instance)',
            refId,
            qryType: 5,
        });
    }));
});
//# sourceMappingURL=VariableQueryEditor.test.js.map