import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';
import { CoreApp } from '@grafana/data';
import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import { createLokiDatasource } from '../mocks';
import { EXPLAIN_LABEL_FILTER_CONTENT } from '../querybuilder/components/LokiQueryBuilderExplained';
import { LokiQueryType } from '../types';
import { LokiQueryEditor } from './LokiQueryEditor';
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() });
});
// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('./monaco-query-field/MonacoQueryFieldWrapper', () => {
    return {
        MonacoQueryFieldWrapper: () => {
            return 'MonacoQueryFieldWrapper';
        },
    };
});
jest.mock('app/core/store', () => {
    return {
        get() {
            return undefined;
        },
        set() { },
        getObject(key, defaultValue) {
            return defaultValue;
        },
    };
});
const defaultQuery = {
    refId: 'A',
    expr: '{label1="foo", label2="bar"}',
};
const datasource = createLokiDatasource();
jest.spyOn(datasource.languageProvider, 'fetchLabels').mockResolvedValue([]);
jest.spyOn(datasource, 'getDataSamples').mockResolvedValue([]);
const defaultProps = {
    datasource,
    query: defaultQuery,
    onRunQuery: () => { },
    onChange: () => { },
};
describe('LokiQueryEditorSelector', () => {
    it('shows code editor if expr and nothing else', () => __awaiter(void 0, void 0, void 0, function* () {
        // We opt for showing code editor for queries created before this feature was added
        render(React.createElement(LokiQueryEditor, Object.assign({}, defaultProps)));
        yield expectCodeEditor();
    }));
    it('shows builder if new query', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(LokiQueryEditor, Object.assign({}, defaultProps, { query: {
                refId: 'A',
                expr: '',
            } })));
        yield expectBuilder();
    }));
    it('shows code editor when code mode is set', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Code);
        yield expectCodeEditor();
    }));
    it('shows builder when builder mode is set', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Builder);
        yield expectBuilder();
    }));
    it('shows Run Query button in Dashboards', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Dashboard });
        yield expectRunQueryButton();
    }));
    it('hides Run Query button in Explore', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Explore });
        yield expectCodeEditor();
        expectNoRunQueryButton();
    }));
    it('hides Run Query button in Correlations Page', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Correlations });
        yield expectCodeEditor();
        expectNoRunQueryButton();
    }));
    it('shows Run Queries button in Dashboards when multiple queries', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Dashboard, queries: [defaultQuery, defaultQuery] });
        yield expectRunQueriesButton();
    }));
    it('changes to builder mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = renderWithMode(QueryEditorMode.Code);
        yield expectCodeEditor();
        yield switchToMode(QueryEditorMode.Builder);
        expect(onChange).toBeCalledWith({
            refId: 'A',
            expr: defaultQuery.expr,
            queryType: LokiQueryType.Range,
            editorMode: QueryEditorMode.Builder,
        });
    }));
    it('Should show the query by default', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({
            editorMode: QueryEditorMode.Builder,
            expr: '{job="grafana"}',
        });
        const selector = yield screen.findByLabelText('selector');
        expect(selector).toBeInTheDocument();
        expect(selector.textContent).toBe('{job="grafana"}');
    }));
    it('Can enable explain', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Builder);
        expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
        yield userEvent.click(screen.getByLabelText('Explain query'));
        expect(yield screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('changes to code mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = renderWithMode(QueryEditorMode.Builder);
        yield expectBuilder();
        yield switchToMode(QueryEditorMode.Code);
        expect(onChange).toBeCalledWith({
            refId: 'A',
            expr: defaultQuery.expr,
            queryType: LokiQueryType.Range,
            editorMode: QueryEditorMode.Code,
        });
    }));
    it('parses query when changing to builder mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = renderWithProps({
            refId: 'A',
            expr: 'rate({instance="host.docker.internal:3000"}[$__interval])',
            editorMode: QueryEditorMode.Code,
        });
        yield expectCodeEditor();
        yield switchToMode(QueryEditorMode.Builder);
        rerender(React.createElement(LokiQueryEditor, Object.assign({}, defaultProps, { query: {
                refId: 'A',
                expr: 'rate({instance="host.docker.internal:3000"}[$__interval])',
                editorMode: QueryEditorMode.Builder,
            } })));
        yield screen.findByText('host.docker.internal:3000');
        expect(screen.getByText('Rate')).toBeInTheDocument();
        expect(screen.getByText('$__interval')).toBeInTheDocument();
    }));
    it('renders the label browser button', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Code);
        expect(yield screen.findByTestId('label-browser-button')).toBeInTheDocument();
    }));
});
function renderWithMode(mode) {
    return renderWithProps({ editorMode: mode });
}
function renderWithProps(overrides, componentProps = {}) {
    const query = defaultsDeep(overrides !== null && overrides !== void 0 ? overrides : {}, cloneDeep(defaultQuery));
    const onChange = jest.fn();
    const allProps = Object.assign(Object.assign({}, defaultProps), componentProps);
    const stuff = render(React.createElement(LokiQueryEditor, Object.assign({}, allProps, { query: query, onChange: onChange })));
    return Object.assign({ onChange }, stuff);
}
function expectCodeEditor() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
    });
}
function expectBuilder() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByText('Label filters')).toBeInTheDocument();
    });
}
function expectRunQueriesButton() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByRole('button', { name: /run queries/i })).toBeInTheDocument();
    });
}
function expectRunQueryButton() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByRole('button', { name: /run query/i })).toBeInTheDocument();
    });
}
function expectNoRunQueryButton() {
    expect(screen.queryByRole('button', { name: /run query/i })).not.toBeInTheDocument();
}
function switchToMode(mode) {
    return __awaiter(this, void 0, void 0, function* () {
        const label = {
            [QueryEditorMode.Code]: /Code/,
            [QueryEditorMode.Builder]: /Builder/,
        }[mode];
        const switchEl = screen.getByLabelText(label);
        yield userEvent.click(switchEl);
    });
}
//# sourceMappingURL=LokiQueryEditor.test.js.map